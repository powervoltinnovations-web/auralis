// Only show deliberate messages; never render tokens or raw server responses.
export function loginError(error: { code?: string; status?: number }): string {
  if (error.code === "email_not_confirmed")
    return "Your email is not confirmed. Confirm it from your inbox, or ask the project administrator to confirm your owner account in Supabase Authentication.";
  if (error.code === "invalid_credentials")
    return "Email or password is incorrect. Use your Auralis account, not your Supabase dashboard login.";
  if (error.status === 429 || error.code === "over_request_rate_limit")
    return "Too many sign-in attempts. Wait a few minutes before trying again.";
  if (error.code === "captcha_failed")
    return "Supabase requires a CAPTCHA. This app does not yet support a CAPTCHA widget; ask the administrator to review the Auth CAPTCHA setting.";
  if (error.status === 0 || error.code === "unexpected_failure")
    return "Cannot reach Supabase. Check your connection and that the project is running.";
  return "Sign-in failed. Check the project's public URL/key and email/password provider in Supabase, then try again.";
}

export function ownerError(error?: { code?: string } | null): string {
  if (error)
    return "Your password was accepted, but the library setup could not be checked. Ask the administrator to verify supabase/schema.sql and the app_owner access policy in this Supabase project.";
  return "Your password was accepted, but this account is not registered as the library owner. Ask the administrator to link your Auth user UUID in app_owner.";
}
