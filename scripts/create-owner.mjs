// Local administrator command only. Never import this file into the application.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { encryptCredentials } from "./owner-credentials.mjs";
import { hiddenPrompt } from "./hidden-prompt.mjs";

const { values } = parseArgs({
  options: { email: { type: "string" } },
  strict: true,
});
const email = values.email?.trim();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

async function main() {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(
      "Pass --email with an address you control. This is your login username.",
    );
  if (!url || !key)
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.admin.local first. Never use a NEXT_PUBLIC name for the administrator key.",
    );
  const project = new URL(url);
  if (
    project.protocol !== "https:" ||
    !project.hostname.endsWith(".supabase.co") ||
    project.pathname !== "/" ||
    project.username ||
    project.password ||
    project.search ||
    project.hash
  )
    throw new Error(
      "Use the exact HTTPS project origin from Supabase Connect.",
    );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const existing = await client.from("app_owner").select("user_id").limit(1);
  if (existing.error)
    throw new Error(
      "Cannot read app_owner. Verify the administrator key and run supabase/schema.sql in this project first.",
    );
  if (existing.data.length)
    throw new Error(
      "An owner is already registered. No account or password was changed. Use the existing owner and Supabase's supported password recovery.",
    );

  const passphrase = await hiddenPrompt(
    "Choose a passphrase for the encrypted credential file (16+ characters): ",
  );
  const confirmation = await hiddenPrompt(
    "Confirm the credential-file passphrase: ",
  );
  if (passphrase !== confirmation)
    throw new Error("Passphrases do not match. No account was created.");
  const password = randomBytes(32).toString("base64url");
  const encrypted = encryptCredentials(
    { project: url, email, password },
    passphrase,
  );

  // Reserve the file before creating an account, so credentials cannot be lost or overwritten.
  const dir = resolve(".secrets");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = resolve(dir, "owner-account.enc.json");
  const handle = await open(file, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(encrypted, null, 2) + "\n");
    await handle.sync();
    const created = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw new Error(
        "Account creation did not complete. Check Supabase Authentication for an existing user with this email. No existing password was reset. The local credential file is retained for recovery; it does not prove the account exists.",
      );
    const linked = await client
      .from("app_owner")
      .insert({ user_id: created.data.user.id });
    if (linked.error)
      throw new Error(
        "The Auth account was created but owner linking failed. Keep the local credential file; inspect app_owner and link the new Auth UUID in the SQL editor. Do not rerun account creation.",
      );
    console.log(
      "Owner account created and linked. Your email is the username.",
    );
    console.log(
      "The generated password is encrypted in .secrets/owner-account.enc.json (local only, excluded from Git).",
    );
    console.log(
      "Run npm run owner:credentials locally to decrypt it, move it into your password manager, and delete .env.admin.local. Sign in with the generated email and password.",
    );
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  // Only our deliberate messages; Supabase raw responses may contain sensitive details.
  console.error(
    error instanceof Error && !error.message.includes("supabase.co")
      ? error.message
      : "Setup failed. Check the project settings locally; no secrets are logged.",
  );
  process.exitCode = 1;
});
