// Requires an already configured Supabase project. No secret values are logged.
// Use short-lived test access tokens via local environment variables, never in chat.
import assert from "node:assert/strict";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const object = process.env.SECURITY_TEST_OBJECT_PATH; // A known existing owner-uploaded file.
const actors = [
  ["anonymous", key],
  ["owner without MFA", process.env.SECURITY_TEST_OWNER_AAL1_TOKEN],
  ["other account with MFA", process.env.SECURITY_TEST_OTHER_AAL2_TOKEN],
];
const owner = process.env.SECURITY_TEST_OWNER_AAL2_TOKEN;
if (!url || !key || !object || !owner || actors.some(([, token]) => !token)) {
  console.error(
    "NOT RUN: configure the Supabase public URL/key, an existing SECURITY_TEST_OBJECT_PATH, and short-lived OWNER_AAL1, OWNER_AAL2, OTHER_AAL2 tokens using the SECURITY_TEST_*_TOKEN names documented in docs/SECURITY.md.",
  );
  process.exit(2);
}
async function request(path, token, method = "GET", body) {
  return fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(token !== key ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
  });
}
async function noRows(response) {
  if (!response.ok) return;
  const data = await response.json();
  assert.ok(
    Array.isArray(data) && data.length === 0,
    "Unauthorized data was returned",
  );
}
for (const [name, token] of actors) {
  for (const table of ["tracks", "playlists"])
    await noRows(await request(`/rest/v1/${table}?select=*`, token));
  await noRows(
    await request("/storage/v1/object/list/media", token, "POST", {
      prefix: object.split("/")[0],
      limit: 100,
    }),
  );
  const sign = await request(
    `/storage/v1/object/sign/media/${object}`,
    token,
    "POST",
    { expiresIn: 60 },
  );
  assert.ok(!sign.ok, "Unauthorized actor received a signed URL");
  const raw = await request(
    `/storage/v1/object/authenticated/media/${object}`,
    token,
  );
  assert.ok(!raw.ok, "Unauthorized actor read a private object");
  console.log(
    `PASS: ${name} cannot read tracks/playlists, list files, sign, or download the known private file`,
  );
}
const publicRead = await fetch(
  `${url}/storage/v1/object/public/media/${object}`,
  { redirect: "error" },
);
assert.ok(!publicRead.ok, "Private bucket is publicly readable");
const accessible = await request("/rest/v1/tracks?select=id", owner);
assert.ok(accessible.ok, "Verified owner cannot access metadata");
assert.ok(
  (await accessible.json()).length > 0,
  "Positive-control library is empty",
);
const signed = await request(
  `/storage/v1/object/sign/media/${object}`,
  owner,
  "POST",
  { expiresIn: 60 },
);
assert.ok(signed.ok, "Verified owner cannot sign an object");
const body = await signed.json();
const signedUrl = new URL(body.signedURL, url + "/storage/v1/");
// Supabase returns a path beginning /object/sign; prefix /storage/v1 if needed.
const playback = signedUrl.pathname.startsWith("/object/")
  ? `${url}/storage/v1${body.signedURL}`
  : signedUrl.href;
const file = await fetch(playback, {
  headers: { Range: "bytes=0-63" },
  redirect: "error",
});
assert.ok(file.ok, "Signed file cannot be played");
await file.body?.cancel();
console.log(
  "PASS: private bucket rejects public download; MFA owner can read metadata, sign, and download the test file",
);
