import {
  admin,
  assertPublicRequest,
  cors,
  hashResetSecret,
  json,
  normalizeBrazilPhone,
  randomDigits,
  sendSms,
} from "../_shared/nervi.ts";

const GENERIC = { ok: true, message: "Se houver uma conta vinculada a esse número, enviaremos um código por SMS." };
const CODE_TTL_MINUTES = 10;
const MIN_INTERVAL_SECONDS = 60;
const MAX_REQUESTS_PER_15_MIN = 5;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  const rejected = assertPublicRequest(req, origin);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const phoneE164 = normalizeBrazilPhone(body?.phone);
    if (!phoneE164) return json(origin, GENERIC);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id")
      .eq("phone_e164", phoneE164)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.user_id) return json(origin, GENERIC);

    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60_000).toISOString();
    const oneMinuteAgo = new Date(now.getTime() - MIN_INTERVAL_SECONDS * 1000).toISOString();

    const { data: recent, error: recentError } = await admin
      .from("nervi_password_reset_codes")
      .select("created_at")
      .eq("user_id", profile.user_id)
      .gte("created_at", fifteenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(MAX_REQUESTS_PER_15_MIN);
    if (recentError) throw recentError;

    if ((recent?.length || 0) >= MAX_REQUESTS_PER_15_MIN) return json(origin, GENERIC);
    if (recent?.[0]?.created_at && recent[0].created_at >= oneMinuteAgo) return json(origin, GENERIC);

    const code = randomDigits(6);
    const codeHash = await hashResetSecret(`${phoneE164}:${code}`);
    const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString();

    const { data: resetRow, error: insertError } = await admin
      .from("nervi_password_reset_codes")
      .insert({
        user_id: profile.user_id,
        phone_e164: phoneE164,
        code_hash: codeHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    try {
      await sendSms(phoneE164, `Nervi: seu código de verificação é ${code}. Ele vale por ${CODE_TTL_MINUTES} minutos. Não compartilhe este código.`);
    } catch (smsError) {
      try {
        await admin.from("nervi_password_reset_codes").delete().eq("id", resetRow.id);
      } catch (_) {}
      throw smsError;
    }

    return json(origin, GENERIC);
  } catch (error) {
    console.error("nervi-request-password-reset", error);
    return json(origin, { error: "reset_request_failed", message: "Não foi possível enviar o código agora. Tente novamente mais tarde." }, 500);
  }
});
