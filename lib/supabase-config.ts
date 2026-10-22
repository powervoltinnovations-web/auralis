export function validateSupabaseConfig(
  url?: string,
  key?: string,
): string | null {
  if (!url && !key) return null;
  if (!url || !key)
    return "Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required. Add them in Vercel, then redeploy.";
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      throw new Error();
    if (parsed.hostname.includes("YOUR_PROJECT".toLowerCase()))
      throw new Error();
  } catch {
    return "Set NEXT_PUBLIC_SUPABASE_URL to your project's HTTPS origin from Supabase Connect, then redeploy.";
  }
  if (key.startsWith("sb_publishable_") && key.length > 20) return null;
  try {
    const payload = JSON.parse(
      atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.role === "anon") return null;
  } catch {}
  return "Use only a Supabase public publishable key or legacy anon key. Never use a secret/service-role key in NEXT_PUBLIC variables. If one was deployed, rotate it in Supabase immediately.";
}
