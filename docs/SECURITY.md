# Security model and validation

## Access boundary

Only the UUID in `app_owner` may access library data or stored media, and its JWT must carry Supabase's verified `aal2` MFA level. The database—not a hidden button or a frontend email check—enforces this through row-level security. Owner configuration is read-only for the authenticated owner and cannot be written by browser roles. The singleton table prevents a second owner.

The migration uses a fixed-search-path security-definer helper, explicit table grants, ownership checks on both reads and writes, constrained metadata, and private storage policies. Object paths are UUID-based, must belong to the owner, and allow only known extensions. Object updates/overwrites are not permitted. Deletion requires confirmation in the UI and authorization in storage and database policies.

The public Supabase project URL/key is not a password. Row-level policies protect data even if someone extracts these public values from JavaScript. Never put a service-role/secret key in `NEXT_PUBLIC_*` variables, this repository, or Vercel's client bundle.

## Credentials and encryption

Supabase Auth manages password hashing, login and TOTP verification. Passwords are never stored in this app's database or code. Set your own unique password securely in Supabase, or use the local administrator helper in SETUP-CHECKLIST.md; no shared/default credentials are included. The helper encrypts its local credential file with AES-256-GCM and scrypt and keeps it out of Git; the credential-file passphrase is not stored. Sign-in errors distinguish invalid credentials, unconfirmed email, rate limits, and project setup failures without exposing raw server responses. Supabase Auth rate limits apply; configure them in the dashboard.

Sessions use browser **sessionStorage**, not persistent localStorage, and are scoped to a browser tab/session. Access tokens must be available to the Supabase browser client, so they are not HttpOnly cookies. XSS or a compromised device can still steal a live session; keep browsers updated. Restore-session behavior varies by browser. Use explicit sign-out on shared devices.

HTTPS protects traffic; Supabase supplies its managed storage-at-rest protections. This is **not end-to-end encryption**, and a project administrator can access stored content. Use provider MFA and protect administrative access.

## Browser and upload protections

- Per-request nonce-based script CSP, no production unsafe-eval, remote connections/media restricted to the configured Supabase origin.
- No frames, plugins or objects; MIME sniffing disabled; referrer suppression and HSTS.
- No third-party analytics, externally loaded fonts, or raw user HTML rendering.
- No app service worker or offline cache of personal media. Page responses use private/no-store headers; private media uses `cacheControl: 0` on upload, but browser/device memory and provider behavior are not secure erasure guarantees.
- Client-side extension, MIME, size, and magic-byte checks. Storage independently restricts MIME and size, and storage policies restrict paths/extensions. **Magic-byte checks are a usability check, not a server-side malware scanner**: a malicious authorized owner can bypass frontend checks and spoof declared MIME. There are no public/third-party uploads.
- Playback URLs expire after 60 seconds. Anyone possessing a live signed URL can use it until expiration, independent of later sign-out. An established download or buffered playback may continue. Never share URLs. Reopening a track obtains a fresh URL; long playback followed by an unbuffered seek may require reopening the track.
- No transcoding, executable previews, HTML uploads or public download routes.

## Tests run in the build workspace

`npm test` includes actual SQL policy execution using embedded PostgreSQL/PGlite, with minimal simulated Supabase `auth` and `storage` schemas. It checks anonymous denial; non-owner denial even with MFA; owner denial without MFA; owner identity visibility; verified-owner CRUD and playlists; blocked ownership changes; constrained paths and sizes; and blocked object overwrites. These are real PostgreSQL policy checks but do not test hosted Supabase's gateways, Auth service, Storage service or project settings.

Unit tests check upload metadata/signatures and production header restrictions. Playwright tests exercise local-preview upload with a generated WAV, media decoding, search, favorites, collection updates, deletion confirmation, rejection of a disguised script, viewport fit, and absence of uncaught browser errors at desktop and iPhone-sized Chromium viewports. Mobile emulation is **not an actual iPhone Safari test**.

See `VALIDATION.md` for the recorded results. Dependency audits only detect known published advisories; passing them is not proof that the software is vulnerability-free.

## Live cloud test

After setup, upload a non-sensitive test file and obtain short-lived session access tokens locally from your own isolated test sessions. Never paste tokens into chat, commit them, or expose them in shared logs. Temporarily create a non-owner test user through the dashboard (public signup remains disabled), enroll its MFA using Supabase's supported APIs, and use an AAL2 session. Production UI correctly refuses that user, so this negative test uses the Auth API directly.

Set these names in a secure local process environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SECURITY_TEST_OBJECT_PATH          # existing owner UUID/file UUID.ext
SECURITY_TEST_OWNER_AAL1_TOKEN      # owner after password, before MFA
SECURITY_TEST_OWNER_AAL2_TOKEN      # owner after MFA
SECURITY_TEST_OTHER_AAL2_TOKEN      # temporary other account after MFA
```

Then run `npm run test:security:live`. It fails rather than silently passing if prerequisites are missing. It tests anonymous/unverified-owner/non-owner metadata, list, sign and download denial against an existing file, public-bucket download denial, and a positive verified-owner metadata/sign/download control. It does not mutate or delete media. Remove the temporary non-owner test user, revoke its sessions, and clear token variables afterward.

Additionally verify cloud uploads/deletes, private bucket settings, disabled signups, enforced rate limits, real-device Safari playback and seeking, and signed-link expiry. The local database tests cover upload/delete policy semantics; live write checks must still be performed in your project before claiming end-to-end security validation.

## Limits and maintenance

This is not a penetration-test certification and cannot promise immunity from hacking. MFA does not prevent stolen authenticated sessions or compromised administrator accounts. There is no custom WAF, CAPTCHA widget, malware scanning, server-side transcoding, or account-recovery bypass. Keep dependencies patched, monitor project logs and quotas, review policy changes, and retain media backups. Keep free-tier availability and egress limits in mind before relying on the site.
