# Connect your Auralis account and deploy

## Supabase

Use your existing project: `https://xpmgbnrqskpkcqqorvus.supabase.co`.

1. Open the SQL editor. If this is a fresh project, run `supabase/schema.sql` once. If the Auralis tables already exist, do not drop them or rerun the whole script blindly. Check that `app_owner`, `tracks`, `playlists`, the private `media` bucket and their policies exist.
2. Under Authentication, enable email/password login. Disable new-user signup and anonymous sign-in. Do not enable Auth CAPTCHA until a CAPTCHA widget is integrated into this app.
3. Under Authentication → Users, find the account you already created. Confirm its email if necessary, and copy its UUID. The login username is its **email**, not a Supabase dashboard username.
4. Check ownership before changing anything:

   ```sql
   select user_id from public.app_owner;
   ```

   If there is no owner row, link your existing account:

   ```sql
   insert into public.app_owner (user_id) values ('YOUR-AUTH-USER-UUID');
   ```

   If a different owner is already present, stop and verify which account owns the library. Do not replace an owner or reset passwords to bypass access controls.
5. Sign in using the owner Auth account email/password. No authenticator code is required.

## Optional: generate a new owner account locally

Use this only if you have no owner yet and want the helper to create one. The command refuses to replace an existing owner or reset an existing account's password. An account with the same email may already exist; use the existing-account steps above in that case.

1. On your own trusted computer, clone this repository and run `npm ci` (Node 22+).
2. Create a local `.env.admin.local` file containing:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://xpmgbnrqskpkcqqorvus.supabase.co
   SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_OR_LEGACY_SERVICE_ROLE_KEY
   ```

   This is a privileged administrator key from Supabase API Keys. Never send it in chat, put it in Vercel, use a `NEXT_PUBLIC` name for it, or commit this file. Restrict local file access (on macOS/Linux: `chmod 600 .env.admin.local`).
3. Run in an interactive local terminal, replacing the email with an address you control:

   ```sh
   npm run owner:create -- --email you@example.com
   ```

   Choose a separate credential-file passphrase of at least 16 characters when prompted. The helper generates a random 256-bit password, creates an email-confirmed Auth user, and inserts its UUID into `app_owner`. Supabase stores the account password as a salted hash. The local helper encrypts the generated credentials with AES-256-GCM and a scrypt-derived key in `.secrets/owner-account.enc.json`. Both `.secrets/` and `.env.admin.local` are ignored by Git. Keep the passphrase separately in your password manager.
4. Run `npm run owner:credentials` locally and enter that passphrase to see your generated password. Move it to a password manager. Delete `.env.admin.local` once setup finishes; delete the encrypted credential file when you no longer need it. The helper does not store the password in website code or create a backdoor.

If setup fails, read the specific error and check Authentication → Users and `app_owner` before retrying. A retained encrypted file can belong to an incomplete attempt and does not prove a live account exists. If Auth creation succeeded but owner linking failed, keep the encrypted password and link the created UUID manually. Do not delete working users, owner records, or credential files blindly.

## Vercel

1. Import GitHub repository `powervoltinnovations-web/auralis`, branch **main**. Framework: **Next.js**. Root directory: repository root. Node: **22.x or 24.x**. Install: `npm ci`. Build: `npm run build`. Leave output directory at the default.
2. Add these public variables in **Project → Settings → Environment Variables**, at least for Production:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://xpmgbnrqskpkcqqorvus.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_AJp1oXAqtKAGyOqBwbqgbQ_HAdobaa-
   ```

   This publishable key is designed to be visible in the browser. Database and storage policies enforce privacy. Never deploy `SUPABASE_SECRET_KEY`, a service-role key, the account password, `.secrets/`, or the credential-file passphrase. Do not set `NEXT_PUBLIC_ENABLE_LOCAL_PREVIEW` in your real deployment.
3. Deploy, or **redeploy after changing variables**: `NEXT_PUBLIC` values are embedded during the build.
4. Copy the HTTPS Vercel site origin into Supabase **Authentication → URL Configuration → Site URL**. This app uses email/password, not email-link callbacks.
5. Open the deployed app in a private window. Confirm the email/password form appears; sign in, upload a small file, reload, and verify playback. Sign out and confirm the library is no longer visible. Do not make the Storage bucket public to fix access errors.

## If login still fails

| Symptom | What to check |
| --- | --- |
| Configuration message; no login form | Both public Vercel variables are set in the correct environment; redeploy. |
| Local preview | In local development this is expected without project settings. In production, remove the explicit preview switch and redeploy with public variables. |
| Incorrect email/password | Use the account under Authentication → Users in this exact project, not dashboard credentials. Use Supabase's supported recovery/admin process if needed. |
| Email not confirmed | Confirm the account email in Supabase or through its confirmation email. |
| Password accepted, library setup failed | Verify the schema exists and the `app_owner` select policy allows the logged-in owner to read its own row. |
| Password accepted, not registered as owner | Link that Auth user's UUID in `app_owner`, after checking the existing owner. |
| Connection failure | Check the project is running, the public URL/key match, and browser/network policies permit the Supabase origin. |

There is no promise that a compromised browser or device cannot steal an active session. Keep a strong unique password, the bucket private, and owner database policies intact. No secret embedded or encrypted inside frontend JavaScript can safely serve as the owner password.


## Upgrading from the authenticator version

1. Run `supabase/migrations/20261022_password_only_owner.sql` in Supabase SQL Editor. It updates the shared owner-access function used by the existing database and storage policies. It preserves your owner UUID, media and tables and can be rerun safely. Do not rerun the fresh-install schema on an existing project.
2. Deploy the latest `main` commit on Vercel (or wait for its connected GitHub deployment).
3. Sign out and sign back in using your existing owner email/password. No password reset or new account is needed. Test an upload and playback.
4. In Supabase Authentication → Users, select your own account and remove/reset the old MFA factor using the administrator controls. The website no longer requests or enrolls factors. This cleanup is especially relevant if an old enrollment secret was shared. Do not delete the user or change `app_owner`.

Application login now relies on the owner's password. Keep MFA on your hosting/provider dashboard accounts if enabled; those accounts are separate from the Auralis login. Code deployment does not apply database migrations or change Supabase Auth factors automatically.
