import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encryptCredentials,
  decryptCredentials,
} from "../scripts/owner-credentials.mjs";

test("owner credentials are encrypted, authenticated, and require the passphrase", () => {
  const record = {
    email: "test@example.com",
    password: "random-generated-password",
  };
  const passphrase = "a-test-only-long-passphrase";
  const encrypted = encryptCredentials(record, passphrase);
  assert.ok(!JSON.stringify(encrypted).includes(record.password));
  assert.ok(!JSON.stringify(encrypted).includes(record.email));
  assert.deepEqual(decryptCredentials(encrypted, passphrase), record);
  assert.throws(() => decryptCredentials(encrypted, "incorrect-passphrase"));
  const tampered = {
    ...encrypted,
    ciphertext: Buffer.from("tampered").toString("base64"),
  };
  assert.throws(() => decryptCredentials(tampered, passphrase));
  assert.throws(() => encryptCredentials(record, "short"));
});
