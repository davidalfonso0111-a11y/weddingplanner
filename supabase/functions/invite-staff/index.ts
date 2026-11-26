// Belles Creators · invite-staff
// Lets the OWNER create an account for a team member (e-mail + temporary password + department).
// Runs with the service role on the server; the caller must be an active owner.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ROLES = ["planner", "stylist", "decoration", "catering", "owner"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";

  // Who is calling? Use their own JWT so RLS / is_owner() apply.
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: isOwner, error: ownerErr } = await asCaller.rpc("is_owner");
  if (ownerErr || isOwner !== true) return json({ error: "Alleen de owner kan teamleden toevoegen" }, 403);

  let body: { email?: string; name?: string; role?: string; password?: string };
  try { body = await req.json(); } catch { return json({ error: "Ongeldige aanvraag" }, 400); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim().slice(0, 80);
  const role = String(body.role ?? "");
  const password = String(body.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Ongeldig e-mailadres" }, 400);
  if (!name) return json({ error: "Naam ontbreekt" }, 400);
  if (!ROLES.includes(role)) return json({ error: "Ongeldige afdeling" }, 400);
  if (password.length < 10) return json({ error: "Tijdelijk wachtwoord moet minstens 10 tekens hebben" }, 400);

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { bc_role: role },
  });
  if (error) return json({ error: error.message }, 400);
  return json({ id: data.user?.id, email, name, role });
});
