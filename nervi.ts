import { createClient } from "npm:@supabase/supabase-js@2.95.0";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
export const PUBLIC_KEY = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
export const SECRET_KEY = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
export const OTP_PEPPER = Deno.env.get("NERVI_OTP_PEPPER") || "";

export const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function allowedOrigin(origin: string | null) {
  if (!origin) return "https://grabrel.github.io";
  if (origin === "https://grabrel.github.io") return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "";
}

export function cors(origin: string | null) {
  const value = allowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": value || "https://grabrel.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function assertPublicRequest(req: Request, origin: string | null) {
  if (req.method !== "POST") return json(origin, { error: "method_not_allowed" }, 405);
  if (origin && !allowedOrigin(origin)) return json(origin, { error: "origin_not_allowed" }, 403);
  if (!SECRET_KEY || !PUBLIC_KEY) return json(origin, { error: "server_not_configured" }, 500);
  if (req.headers.get("apikey") !== PUBLIC_KEY) return json(origin, { error: "invalid_client" }, 401);
  return null;
}

export function normalizeUsername(value: unknown) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("pt-BR");
}

export function displayUsername(value: unknown) {
  return String(value || "").normalize("NFKC").trim();
}

export function normalizeBrazilPhone(value: unknown) {
  let digits = String(value || "").replace(/\D+/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (!digits.startsWith("55") || (digits.length !== 12 && digits.length !== 13)) return "";
  return "+" + digits;
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function internalEmail(username: string) {
  const hash = await sha256Hex(normalizeUsername(username));
  return `u-${hash}@users.nervi.invalid`;
}

export async function hashResetSecret(value: string) {
  if (!OTP_PEPPER) throw new Error("NERVI_OTP_PEPPER não configurado.");
  return sha256Hex(`${OTP_PEPPER}:${value}`);
}

export function randomDigits(length = 6) {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  const max = 10 ** length;
  return String(bytes[0] % max).padStart(length, "0");
}

export function randomToken(bytesLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function sendSms(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const apiKey = Deno.env.get("TWILIO_API_KEY") || "";
  const apiSecret = Deno.env.get("TWILIO_API_SECRET") || "";
  const from = Deno.env.get("TWILIO_FROM") || "";
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";

  if (!accountSid || (!from && !messagingServiceSid)) throw new Error("Twilio não configurado.");
  const user = apiKey && apiSecret ? apiKey : accountSid;
  const pass = apiKey && apiSecret ? apiSecret : authToken;
  if (!user || !pass) throw new Error("Credenciais Twilio ausentes.");

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("Body", body);
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else form.set("From", from);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Twilio SMS:", response.status, text.slice(0, 500));
    throw new Error("Falha no envio do SMS.");
  }
}
