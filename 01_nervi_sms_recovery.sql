-- Nervi / Cofrinho.exe v0.7
-- Atualização incremental para celular + recuperação de senha por SMS.
-- Execute no SQL Editor do projeto Supabase do Nervi APÓS revisar o arquivo.
-- Não apaga contas, cofrinho_state, histórico nem ciclos existentes.

begin;

-- ============================================================
-- 1. CELULAR ASSOCIADO AO PERFIL
-- ============================================================

alter table public.profiles
  add column if not exists phone_e164 text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and conname = 'profiles_phone_e164_format'
  ) then
    alter table public.profiles
      add constraint profiles_phone_e164_format
      check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{9,14}$');
  end if;
end
$$;

create unique index if not exists profiles_phone_e164_unique
  on public.profiles (phone_e164)
  where phone_e164 is not null;

-- O frontend autenticado pode atualizar somente o próprio perfil graças à RLS
-- existente. Este GRANT apenas adiciona a coluna nova aos campos editáveis.
grant update (phone_e164) on public.profiles to authenticated;

-- ============================================================
-- 2. CÓDIGOS E SESSÕES DE REDEFINIÇÃO
--    Tabelas ficam no schema public por simplicidade operacional,
--    mas sem políticas para anon/authenticated. Apenas service role acessa.
-- ============================================================

create table if not exists public.nervi_password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  code_hash text not null,
  attempts smallint not null default 0 check (attempts between 0 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nervi_reset_codes_phone_created_idx
  on public.nervi_password_reset_codes (phone_e164, created_at desc);

create index if not exists nervi_reset_codes_user_created_idx
  on public.nervi_password_reset_codes (user_id, created_at desc);

alter table public.nervi_password_reset_codes enable row level security;
revoke all on public.nervi_password_reset_codes from anon, authenticated;

create table if not exists public.nervi_password_reset_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nervi_reset_sessions_user_created_idx
  on public.nervi_password_reset_sessions (user_id, created_at desc);

alter table public.nervi_password_reset_sessions enable row level security;
revoke all on public.nervi_password_reset_sessions from anon, authenticated;

-- ============================================================
-- 3. SINCRONIZAÇÃO DO JSON PRINCIPAL -> TABELAS CORE
--    Mantém compatibilidade com estados antigos que ainda não têm telefone.
--    Um estado antigo sem phoneE164 NÃO apaga um telefone já salvo no perfil.
-- ============================================================

create or replace function public.sync_cofrinho_state_to_core()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  p jsonb;
  g jsonb;
  v_locked_until date;
  v_cycle_number integer;
  v_duration smallint;
  v_phone_e164 text;
begin
  p := new.state -> 'profile';
  g := new.state -> 'goal';

  if p is null or jsonb_typeof(p) <> 'object' then
    return new;
  end if;

  v_phone_e164 := nullif(trim(p->>'phoneE164'), '');

  if g is not null and jsonb_typeof(g) = 'object' and nullif(g->>'endDate','') is not null then
    v_locked_until := (g->>'endDate')::date;
  elsif nullif(p->>'lockedUntil','') is not null then
    v_locked_until := (p->>'lockedUntil')::date;
  else
    v_locked_until := null;
  end if;

  insert into public.profiles (
    user_id, username, photo, phone_e164, monthly_income, payday, locked_until
  ) values (
    new.user_id,
    coalesce(nullif(trim(p->>'username'),''), 'Usuário'),
    coalesce(p->'photo', '{"type":"none","value":""}'::jsonb),
    v_phone_e164,
    coalesce(nullif(p->>'monthlyIncome','')::numeric, 0),
    coalesce(nullif(p->>'payday','')::smallint, 5),
    v_locked_until
  )
  on conflict (user_id) do update set
    username = excluded.username,
    photo = excluded.photo,
    phone_e164 = coalesce(excluded.phone_e164, public.profiles.phone_e164),
    monthly_income = excluded.monthly_income,
    payday = excluded.payday,
    locked_until = excluded.locked_until;

  if g is not null and jsonb_typeof(g) = 'object' then
    v_cycle_number := greatest(coalesce(nullif(g->>'cycleNumber','')::integer, 1), 1);
    v_duration := greatest(1, least(120, coalesce(nullif(g->>'durationMonths','')::smallint, 12)));

    if exists (
      select 1 from public.goal_cycles
      where user_id = new.user_id and cycle_number = v_cycle_number
    ) then
      update public.goal_cycles
         set name = coalesce(nullif(trim(g->>'name'),''), 'Minha reserva'),
             category = coalesce(nullif(trim(g->>'category'),''), 'Objetivo pessoal'),
             target = greatest(coalesce(nullif(g->>'target','')::numeric, 0.01), 0.01),
             duration_months = v_duration,
             start_date = coalesce(nullif(g->>'startDate','')::date, current_date),
             end_date = coalesce(nullif(g->>'endDate','')::date, current_date + interval '12 months'),
             status = case when coalesce(nullif(g->>'endDate','')::date, current_date) <= current_date then 'completed' else 'active' end
       where user_id = new.user_id and cycle_number = v_cycle_number;
    else
      insert into public.goal_cycles (
        user_id, cycle_number, name, category, target, duration_months,
        monthly_contribution, start_date, end_date, status
      ) values (
        new.user_id,
        v_cycle_number,
        coalesce(nullif(trim(g->>'name'),''), 'Minha reserva'),
        coalesce(nullif(trim(g->>'category'),''), 'Objetivo pessoal'),
        greatest(coalesce(nullif(g->>'target','')::numeric, 0.01), 0.01),
        v_duration,
        0,
        coalesce(nullif(g->>'startDate','')::date, current_date),
        coalesce(nullif(g->>'endDate','')::date, current_date + interval '12 months'),
        case when coalesce(nullif(g->>'endDate','')::date, current_date) <= current_date then 'completed' else 'active' end
      );
    end if;
  end if;

  return new;
end;
$function$;

-- SECURITY DEFINER já existia nesta função. Restrinja a execução direta:
revoke all on function public.sync_cofrinho_state_to_core() from public, anon, authenticated;

commit;

-- Verificações úteis após executar:
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='profiles' and column_name='phone_e164';
-- select tablename, rowsecurity from pg_tables
--  where schemaname='public' and tablename like 'nervi_password_reset_%';
