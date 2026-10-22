import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateFile,
  validateSignature,
  securityHeaders,
  MAX_FILE_BYTES,
} from "../lib/security";
test("rejects executable, mismatched, empty, and oversized uploads", () => {
  for (const file of [
    { name: "payload.svg", type: "image/svg+xml", size: 30 },
    { name: "payload.mp3.html", type: "audio/mpeg", size: 30 },
    { name: "payload.mp3", type: "text/html", size: 30 },
    { name: "empty.mp3", type: "audio/mpeg", size: 0 },
    { name: "large.mp4", type: "video/mp4", size: MAX_FILE_BYTES + 1 },
  ])
    assert.ok(validateFile(file));
  assert.equal(
    validateFile({ name: "song.mp3", type: "audio/mpeg", size: 200 }),
    null,
  );
});
test("checks file signatures independently of MIME labels", async () => {
  assert.equal(
    await validateSignature(new Blob(["<script>alert(1)</script>"]), "mp3"),
    false,
  );
  assert.equal(await validateSignature(new Blob(["ID3\x04\x00"]), "mp3"), true);
  assert.equal(
    await validateSignature(new Blob(["RIFFxxxxWAVEfmt "]), "wav"),
    true,
  );
  assert.equal(
    await validateSignature(new Blob(["xxxxftypisom"]), "mp4"),
    true,
  );
  assert.equal(
    await validateSignature(new Blob(["not a video"]), "mp4"),
    false,
  );
});
test("production headers restrict scripts, framing, objects, and remote connections", () => {
  const h = securityHeaders("unique-nonce", "https://project.supabase.co");
  assert.match(
    h["Content-Security-Policy"],
    /script-src 'self' 'nonce-unique-nonce' 'strict-dynamic';/,
  );
  assert.ok(!h["Content-Security-Policy"].includes("unsafe-eval"));
  assert.match(h["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(h["Content-Security-Policy"], /object-src 'none'/);
  assert.match(
    h["Content-Security-Policy"],
    /connect-src 'self' https:\/\/project.supabase.co;/,
  );
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["Referrer-Policy"], "no-referrer");
  assert.equal(h["Cache-Control"], "private, no-store");
});
