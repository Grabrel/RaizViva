# Backend Supabase — Nervi v0.7

Esta pasta versiona a parte de backend necessária para **celular + recuperação de senha por SMS**.

> A pasta pode ficar no GitHub. **Segredos reais não podem.** O arquivo `.env.example` contém apenas nomes e placeholders.

## 1. Banco de dados

No projeto Supabase do Nervi, abra o SQL Editor, revise e execute:

```text
supabase/sql/01_nervi_sms_recovery.sql
```

O script é incremental: adiciona `phone_e164`, cria as tabelas de códigos/sessões de recuperação e atualiza a função que sincroniza `cofrinho_state` com `profiles`.

## 2. Edge Functions

Implante estas funções no projeto Nervi:

```text
nervi-create-account
nervi-check-username
nervi-request-password-reset
nervi-verify-reset-code
nervi-reset-password
```

Todas usam o módulo compartilhado:

```text
supabase/functions/_shared/nervi.ts
```

Elas são chamadas **antes de existir uma sessão autenticada** (criação de conta, consulta de usuário e recuperação), portanto devem ser publicadas como funções públicas, com a validação customizada do `apikey` já implementada no código.

## 3. Secrets

Cadastre como Secrets das Edge Functions:

- `NERVI_OTP_PEPPER`: valor longo, aleatório e exclusivo;
- `TWILIO_ACCOUNT_SID`;
- `TWILIO_AUTH_TOKEN` **ou** `TWILIO_API_KEY` + `TWILIO_API_SECRET`;
- `TWILIO_FROM` **ou** `TWILIO_MESSAGING_SERVICE_SID`.

Os secrets do próprio Supabase são disponibilizados pelo runtime. Não copie `service_role`/secret key para o frontend.

## 4. Comportamento da recuperação

1. O usuário informa o celular.
2. A resposta da tela é neutra, sem confirmar se aquele celular existe.
3. Se houver uma conta, é criado um código de 6 dígitos com validade de 10 minutos.
4. O código salvo no banco é somente um hash com pepper.
5. Há intervalo mínimo de 60 segundos e limite de solicitações.
6. Após validar o código, o usuário recebe um token curto de redefinição.
7. A troca da senha ocorre somente na Edge Function com privilégio administrativo.
8. Código e token são de uso único.

## 5. Usuário errado x senha errada

A v0.7 inclui `nervi-check-username` para permitir as mensagens solicitadas no login:

- `Usuário incorreto.`
- `Senha incorreta.`

Isso significa que o sistema deliberadamente permite verificar se um **nome de usuário** existe. A tela de recuperação por celular continua neutra e não informa se um número está cadastrado.

## 6. Usuários antigos

Contas antigas podem continuar com `phone_e164` vazio até adicionarem um celular em **Configurações**. Novas contas criadas pela interface v0.7 exigem um celular válido com DDD.
