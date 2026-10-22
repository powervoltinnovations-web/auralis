import { test, expect } from "@playwright/test";
function wav() {
  const samples = 8000;
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    b.writeInt16LE(Math.sin((i / 8000) * 440 * Math.PI * 2) * 1200, 44 + i * 2);
  return b;
}
test("private preview, functional upload/play/favorite/search/collection/delete, and mobile fit", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  await expect(
    page.getByRole("heading", { name: "Your own frequency." }),
  ).toBeVisible();
  await expect(
    page.getByText("Local preview", { exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/${info.project.name}-overview.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "Evening.wav",
      mimeType: "audio/wav",
      buffer: wav(),
    });
  await expect(
    page.getByRole("button", { name: "Evening Personal upload" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evening Personal upload" }).click();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((el: HTMLAudioElement) => el.readyState),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.locator("audio").evaluate((el: HTMLAudioElement) => el.duration),
    )
    .toBe(1);
  await page
    .getByRole("button", { name: "Favorite Evening", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unfavorite Evening", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Evening to collection" }).click();
  await page
    .getByRole("textbox", { name: "Search your library" })
    .fill("does-not-exist");
  await expect(
    page.getByRole("heading", { name: "No matching files" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search your library" })
    .fill("Evening");
  await page
    .getByRole("button", { name: "Delete Evening", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete file", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Evening Personal upload" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("rejects a disguised executable upload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "payload.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("<script>alert(1)</script>"),
    });
  await expect(page.getByRole("status")).toContainText("contents do not match");
  await expect(
    page.getByRole("button", { name: "payload Personal upload" }),
  ).toHaveCount(0);
});
test("plays a real H.264/AAC video and supports closing the player", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/sample.mp4");
  await page.getByRole("button", { name: "sample Personal upload" }).click();
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.videoWidth))
    .toBe(320);
  await video.evaluate((el: HTMLVideoElement) => el.play());
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close video", exact: true }).click();
  await expect(video).toHaveCount(0);
});
test("upload dialog traps keyboard focus and closes with Escape", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Upload files",
    exact: true,
  });
  await trigger.click();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Choose files" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close upload" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
