import { createClient } from "@supabase/supabase-js";
import { validateSupabaseConfig } from "./supabase-config";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseConfigError =
  validateSupabaseConfig(url, key) ??
  (!url &&
  !key &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_PREVIEW !== "true"
    ? "Supabase is not connected. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy to enable sign-in."
    : null);
export const supabase =
  url && key && !supabaseConfigError
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storage:
            typeof window === "undefined" ? undefined : window.sessionStorage,
        },
      })
    : null;
