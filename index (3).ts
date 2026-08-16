import {
  admin,
  assertPublicRequest,
  cors,
  json,
  normalizeUsername,
} from "../_shared/nervi.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  const rejected = assertPublicRequest(req, origin);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const username = normalizeUsername(body?.username);
    if (!username || username.length > 30) return json(origin, { exists: false });

    const { data, error } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("username", username.replace(/([%_\\])/g, "\\$1"))
      .limit(1);
    if (error) throw error;

    return json(origin, { exists: Boolean(data?.length) });
  } catch (error) {
    console.error("nervi-check-username", error);
    return json(origin, { error: "lookup_failed", message: "Não foi possível verificar o usuário agora." }, 500);
  }
});
