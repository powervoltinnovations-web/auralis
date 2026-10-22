# Auralis

**Your own frequency.** A private, single-owner music and video library with a spatial-style interface. Upload from a laptop or Android, then sign in and stream on iPhone Safari.

Built with Next.js, React, TypeScript and Supabase. Deploy the frontend on Vercel and keep files in a private Supabase Storage bucket. No media files or secrets are included in this repository.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

In local development, without Supabase environment variables the app opens a clearly labeled **local preview**. Production requires both public Supabase settings and displays a configuration message if they are missing. You can try uploads, playback, favorites and a collection. Preview files never leave your browser and disappear on reload; they do not sync to another device. The initial sample titles are illustrations and contain no audio.

For cloud mode, copy `.env.example` to `.env.local` and set your Supabase project URL and **public publishable/anon key**. Restart the server after changing these values. Never use a secret or service-role key in this app.

## Features

- Responsive dark spatial-style interface with translucent panels and CSS record artwork.
- MP3, AAC/M4A, WAV and MP4 uploads, capped at 50 MB per file.
- Music and video playback, seek, volume, shuffle, repeat, and Media Session integration.
- Search, favorites, one named personal collection, and confirmed file deletion.
- One owner account with password login and required authenticator MFA.
- Private database and Storage policies, short-lived playback links and restrictive browser headers.

Start with [your project setup checklist](docs/SETUP-CHECKLIST.md) for the exact Supabase and Vercel steps, existing-owner repair, and an optional encrypted account-creation helper.

See [deployment instructions](docs/DEPLOYMENT.md) for the account and hosting steps and [security documentation](docs/SECURITY.md) for protections, test evidence and limitations.

## Validate

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:auth
npm audit --omit=dev
```

For a system Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` before the browser test command. The preview browser suite creates its own explicit production preview build; the separate auth suite uses intercepted Supabase responses to test password/MFA behavior. Both override public configuration for their own test servers. They include a generated one-second WAV fixture, not copyrighted media.

`npm test` executes the actual migration policies in embedded PostgreSQL (PGlite) with simulated Supabase authentication and storage schemas. It does not replace testing a real Supabase project. After configuring the cloud project, follow `docs/SECURITY.md` to run `npm run test:security:live` and the real-device checklist.

## iPhone and costs

Tap play to start audio on iPhone. MP3/AAC audio and H.264/AAC MP4 video are the safest choices; MP4 is a container and not every codec plays in Safari. There is no transcoding. Lock-screen/background playback depends on iOS and browser behavior and must be checked on your device. System volume controls may be required on iPhone.

Vercel Hobby and Supabase Free are the intended starting plans. Their quotas, billing rules, availability and pausing behavior can change. Verify current limits before deploying. The 50 MB upload cap is an application limit, not a promise of unlimited storage or streaming. Streaming consumes Supabase egress and your phone's data. See the official pricing links in the deployment guide.

Original repository by Om Kailash Kawate.
