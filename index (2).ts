import {
  admin,
  assertPublicRequest,
  cors,
  displayUsername,
  internalEmail,
  json,
  normalizeBrazilPhone,
  normalizeUsername,
} from "../_shared/nervi.ts";

function moneyPlan(target: number, months: number) {
  const targetCents = Math.round(target * 100);
  const regularCents = Math.floor(targetCents / months);
  const finalCents = targetCents - regularCents * (months - 1);
  return { regular: regularCents / 100, final: finalCents / 100 };
}

function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, (m - 1) + months, d));
  if (target.getUTCDate() !== d) target.setUTCDate(0);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  const rejected = assertPublicRequest(req, origin);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const username = displayUsername(body?.username);
    const usernameKey = normalizeUsername(username);
    const password = String(body?.password || "");
    const rawPhone = String(body?.phone || "").trim();
    const phoneE164 = rawPhone ? normalizeBrazilPhone(rawPhone) : "";
    const state = structuredClone(body?.state || {});

    if (usernameKey.length < 3 || usernameKey.length > 30) {
      return json(origin, { error: "invalid_username", message: "O usuário deve ter entre 3 e 30 caracteres." }, 400);
    }
    if (!/^[\p{L}\p{N}._-]+$/u.test(username)) {
      return json(origin, { error: "invalid_username", message: "Use apenas letras, números, ponto, hífen ou sublinhado no usuário." }, 400);
    }
    if (password.length < 6 || password.length > 128) {
      return json(origin, { error: "invalid_password", message: "A senha deve ter entre 6 e 128 caracteres." }, 400);
    }
    if (rawPhone && !phoneE164) {
      return json(origin, { error: "invalid_phone", message: "Informe um celular brasileiro válido com DDD." }, 400);
    }

    const profile = state?.profile;
    const goal = state?.goal;
    if (!profile || !goal) return json(origin, { error: "invalid_state", message: "Dados do perfil incompletos." }, 400);

    const income = Number(profile.monthlyIncome);
    const payday = Number(profile.payday);
    const target = Number(goal.target);
    const duration = Math.floor(Number(goal.durationMonths));

    if (!Number.isFinite(income) || income < 0) return json(origin, { error: "invalid_income" }, 400);
    if (!Number.isInteger(payday) || payday < 1 || payday > 31) return json(origin, { error: "invalid_payday" }, 400);
    if (!Number.isFinite(target) || target <= 0) return json(origin, { error: "invalid_target" }, 400);
    if (!Number.isInteger(duration) || duration < 1 || duration > 120) return json(origin, { error: "invalid_duration" }, 400);

    if (phoneE164) {
      const { data: phoneOwner, error: phoneLookupError } = await admin
        .from("profiles")
        .select("user_id")
        .eq("phone_e164", phoneE164)
        .maybeSingle();
      if (phoneLookupError) throw phoneLookupError;
      if (phoneOwner) {
        return json(origin, { error: "phone_taken", message: "Esse celular já está vinculado a outra conta." }, 409);
      }
    }

    const plan = moneyPlan(target, duration);
    if (plan.regular > income) {
      return json(origin, { error: "goal_above_income", message: "A reserva mensal necessária supera a renda informada." }, 400);
    }

    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(goal.startDate || "")) ? String(goal.startDate) : todayISO();
    const endDate = addMonthsISO(startDate, duration);

    state.version = "0.7.0";
    state.profile = {
      ...profile,
      username,
      phoneE164,
      monthlyIncome: income,
      payday,
      lockedUntil: endDate,
    };
    state.goal = {
      ...goal,
      target,
      durationMonths: duration,
      monthlyContribution: plan.regular,
      finalContribution: plan.final,
      startDate,
      endDate,
      cycleNumber: Math.max(1, Math.floor(Number(goal.cycleNumber || 1))),
    };

    const email = await internalEmail(username);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
      app_metadata: { login_kind: "nervi_username" },
    });

    if (createError || !created.user) {
      const message = String(createError?.message || "");
      const duplicate = /already|registered|exists|duplicate/i.test(message);
      return json(origin, {
        error: duplicate ? "username_taken" : "auth_create_failed",
        message: duplicate ? "Esse nome de usuário já está em uso." : "Não foi possível criar a conta agora.",
      }, duplicate ? 409 : 400);
    }

    const userId = created.user.id;
    const { error: stateError } = await admin.from("cofrinho_state").insert({ user_id: userId, state });

    if (stateError) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      const duplicate = stateError.code === "23505" || /duplicate|unique/i.test(String(stateError.message || ""));
      return json(origin, {
        error: duplicate ? "username_taken" : "state_create_failed",
        message: duplicate ? "Esse nome de usuário ou celular já está em uso." : "Não foi possível salvar o perfil da conta.",
      }, duplicate ? 409 : 400);
    }

    return json(origin, { ok: true, user_id: userId, username }, 201);
  } catch (error) {
    console.error("nervi-create-account", error);
    return json(origin, { error: "unexpected_error", message: "Não foi possível criar a conta agora." }, 500);
  }
});
