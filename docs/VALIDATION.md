# Validation record — 22 October 2026

Validated in the development workspace with Node.js 24.19.0 and Next.js 16.4.2.

For the password-only update, TypeScript, all 14 unit/database checks, all six auth browser checks and the production build were rerun. Database tests validate the fresh schema, upgrade from the old MFA function, repeated migration, owner CRUD at aal1, and anonymous/non-owner denial. The preview media, audit, encryption prompt and production-form smoke results below are retained from the previous baseline; those unrelated checks were not rerun for this update. The hosted migration and removal of old Auth factors still require Supabase administrator action.

| Check | Result |
| --- | --- |
| TypeScript checking | Passed |
| Production Next.js build | Passed |
| Unit, credential encryption, and PostgreSQL policy tests | 14 passed, 0 failed, 0 skipped (includes parent/subtest accounting) |
| Password-only login browser tests with intercepted Supabase responses | 6 passed; invalid credentials, unconfirmed email, missing schema, non-owner denial, password-only entry with/without an existing MFA factor, reload and sign-out |
| Desktop Chromium browser tests | 4 passed |
| iPhone-sized Chromium browser tests | 4 passed |
| H.264/AAC video decoding and playback | Passed in both browser layouts |
| WAV upload and decoding | Passed in both browser layouts |
| Keyboard focus trap and Escape/return focus | Passed in both browser layouts |
| Dependency audit, production and development | 0 known vulnerabilities reported |
| Git whitespace check | Passed |
| Production sign-in screen with supplied public URL/key | Passed; browser hydrated, form visible, no uncaught errors, restrictive CSP includes configured origin |
| Local credential helper checks | Encryption round trip, wrong-passphrase/tamper rejection and non-echoing terminal prompt passed; missing-email precondition correctly rejected |
| Hosted Supabase Auth/Storage integration | Not run: this workspace's egress proxy rejects the project domain (CONNECT 403); no owner/admin access or live test sessions supplied |
| Live owner account creation | Not run; administrator credentials and an owner email were not supplied. The helper is prepared, not a claim of an existing account. |
| Real iPhone Safari / lock-screen / mobile data | Not run: requires the user's device and deployed cloud project |
| Public Vercel deployment | Pending user's Vercel/Supabase setup |

The eight media/UI browser tests exercise an explicit production local-preview build. The six authentication browser tests intercept Supabase responses and verify the real client password-only login flow without contacting a live project. PostgreSQL tests execute the migration with simulated Supabase auth/storage schemas. None substitutes for the hosted-project checks in SECURITY.md. No claim of complete security certification or an unhackable system is made.

The generated two-second `tests/fixtures/sample.mp4` contains a solid color and synthesized tone; no personal or copyrighted media is included.
