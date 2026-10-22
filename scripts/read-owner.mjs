import { readFile } from "node:fs/promises";
import { decryptCredentials } from "./owner-credentials.mjs";
import { hiddenPrompt } from "./hidden-prompt.mjs";

try {
  const envelope = JSON.parse(
    await readFile(".secrets/owner-account.enc.json", "utf8"),
  );
  const passphrase = await hiddenPrompt("Credential-file passphrase: ");
  const record = decryptCredentials(envelope, passphrase);
  console.log("Project:", record.project);
  console.log("Login email:", record.email);
  console.log(
    "Generated password (move to your password manager):",
    record.password,
  );
  console.log(
    "This local file does not prove that account creation and owner linking completed; check the creation command's result.",
  );
} catch {
  console.error(
    "Cannot decrypt credentials. Check the local file and passphrase. No account was changed.",
  );
  process.exitCode = 1;
}
