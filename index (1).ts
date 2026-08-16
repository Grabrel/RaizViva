import {
  admin,
  assertPublicRequest,
  cors,
  hashResetSecret,
  json,
} from "../_shared/nervi.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  const rejected = assertPublicRequest(req, origin);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const token = String(body?.reset_token || "");
    const password = String(body?.password || "");

    if (token.length < 30) {
      return json(origin, { error: "invalid_reset_token", message: "A validação expirou. Solicite um novo código." }, 400);
    }
    if (password.length < 6 || password.length > 128) {
      return json(origin, { error: "invalid_password", message: "A senha deve ter entre 6 e 128 caracteres." }, 400);
    }

    const tokenHash = await hashResetSecret(`reset:${token}`);
    const { data: session, error: sessionError } = await admin
      .from("nervi_password_reset_sessions")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session?.user_id) {
      return json(origin, { error: "invalid_reset_token", message: "A validação expirou. Solicite um novo código." }, 400);
    }

    const { error: authError } = await admin.auth.admin.updateUserById(session.user_id, { password });
    if (authError) throw authError;

    const now = new Date().toISOString();
    const { error: consumeError } = await admin
      .from("nervi_password_reset_sessions")
      .update({ consumed_at: now })
      .eq("id", session.id)
      .is("consumed_at", null);
    if (consumeError) throw consumeError;

    try {
      await admin
        .from("nervi_password_reset_codes")
        .update({ consumed_at: now })
        .eq("user_id", session.user_id)
        .is("consumed_at", null);
    } catch (_) {}

    return json(origin, { ok: true });
  } catch (error) {
    console.error("nervi-reset-password", error);
    return json(origin, { error: "password_reset_failed", message: "Não foi possível alterar a senha agora." }, 500);
  }
});
