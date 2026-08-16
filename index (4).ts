import {
  admin,
  assertPublicRequest,
  cors,
  hashResetSecret,
  json,
  normalizeBrazilPhone,
  randomToken,
} from "../_shared/nervi.ts";

const MAX_ATTEMPTS = 5;
const SESSION_TTL_MINUTES = 10;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  const rejected = assertPublicRequest(req, origin);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const phoneE164 = normalizeBrazilPhone(body?.phone);
    const code = String(body?.code || "").replace(/\D+/g, "");
    if (!phoneE164 || !/^\d{6}$/.test(code)) {
      return json(origin, { error: "invalid_code", message: "Código inválido ou expirado." }, 400);
    }

    const { data: rows, error: lookupError } = await admin
      .from("nervi_password_reset_codes")
      .select("id, user_id, code_hash, attempts, expires_at")
      .eq("phone_e164", phoneE164)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (lookupError) throw lookupError;

    const row = rows?.[0];
    if (!row || Number(row.attempts || 0) >= MAX_ATTEMPTS) {
      return json(origin, { error: "invalid_code", message: "Código inválido ou expirado." }, 400);
    }

    const expectedHash = await hashResetSecret(`${phoneE164}:${code}`);
    if (expectedHash !== row.code_hash) {
      const nextAttempts = Number(row.attempts || 0) + 1;
      await admin
        .from("nervi_password_reset_codes")
        .update({ attempts: nextAttempts, consumed_at: nextAttempts >= MAX_ATTEMPTS ? new Date().toISOString() : null })
        .eq("id", row.id);
      return json(origin, { error: "invalid_code", message: "Código inválido ou expirado." }, 400);
    }

    const consumedAt = new Date().toISOString();
    const { error: consumeError } = await admin
      .from("nervi_password_reset_codes")
      .update({ consumed_at: consumedAt })
      .eq("id", row.id)
      .is("consumed_at", null);
    if (consumeError) throw consumeError;

    const token = randomToken(32);
    const tokenHash = await hashResetSecret(`reset:${token}`);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString();

    const { error: sessionError } = await admin
      .from("nervi_password_reset_sessions")
      .insert({ user_id: row.user_id, token_hash: tokenHash, expires_at: expiresAt });
    if (sessionError) throw sessionError;

    return json(origin, { ok: true, reset_token: token });
  } catch (error) {
    console.error("nervi-verify-reset-code", error);
    return json(origin, { error: "verification_failed", message: "Não foi possível validar o código agora." }, 500);
  }
});
