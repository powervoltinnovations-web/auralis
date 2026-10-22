import { test } from "node:test";
import assert from "node:assert/strict";
import { loginError, ownerError } from "../lib/auth";
import { validateSupabaseConfig } from "../lib/supabase-config";

test("auth diagnostics distinguish credentials, confirmation, rate limits, and owner setup", () => {
  assert.match(
    loginError({ code: "invalid_credentials" }),
    /Email or password is incorrect/,
  );
  assert.match(
    loginError({ code: "email_not_confirmed" }),
    /email is not confirmed/,
  );
  assert.match(loginError({ status: 429 }), /Too many/);
  assert.match(loginError({ code: "captcha_failed" }), /CAPTCHA/);
  assert.match(ownerError({ code: "42P01" }), /schema.sql/);
  assert.match(ownerError(null), /UUID in app_owner/);
});

test("public configuration rejects privileged keys, partial settings, and invalid origins", () => {
  const url = "https://example.supabase.co";
  const jwt = (role: string) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  assert.equal(validateSupabaseConfig(), null);
  assert.equal(
    validateSupabaseConfig(url, "sb_publishable_example_public_key"),
    null,
  );
  assert.equal(validateSupabaseConfig(url, jwt("anon")), null);
  for (const key of [
    jwt("service_role"),
    "sb_secret_never_expose",
    "placeholder",
  ])
    assert.match(validateSupabaseConfig(url, key)!, /Never use a secret/);
  assert.match(validateSupabaseConfig(url)!, /Both/);
  assert.match(
    validateSupabaseConfig("http://example.supabase.co", jwt("anon"))!,
    /HTTPS origin/,
  );
  assert.match(
    validateSupabaseConfig(`${url}/auth/v1`, jwt("anon"))!,
    /HTTPS origin/,
  );
});
