import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

export async function hiddenPrompt(message) {
  if (!process.stdin.isTTY)
    throw new Error(
      "Run this command in an interactive local terminal; do not pass passwords through command arguments.",
    );
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const prompt = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  process.stdout.write(message);
  try {
    return await prompt.question("");
  } finally {
    prompt.close();
    process.stdout.write("\n");
  }
}
