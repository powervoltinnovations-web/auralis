import { test, expect, type Page } from "@playwright/test";

const ownerId = "11111111-1111-4111-8111-111111111111";
const factorId = "22222222-2222-4222-8222-222222222222";
type Scenario = {
  loginCode?: string;
  missingSchema?: boolean;
  nonOwner?: boolean;
  enrolled?: boolean;
};

async function mockSupabase(page: Page, scenario: Scenario = {}) {
  const aal = "aal1";
  const enrolled = !!scenario.enrolled;
  const factors = () =>
    enrolled
      ? [
          {
            id: factorId,
            factor_type: "totp",
            status: "verified",
            friendly_name: "Auralis",
          },
        ]
      : [];
  const user = () => ({
    id: ownerId,
    aud: "authenticated",
    role: "authenticated",
    email: "owner@example.com",
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    factors: factors(),
  });
  const session = () => ({
    access_token: `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: ownerId, role: "authenticated", aal, exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] })).toString("base64url")}.test-signature`,
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    user: user(),
  });
  await page.route(
    "https://auralis-auth-test.supabase.co/**",
    async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const fulfill = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          headers: {
            "x-supabase-api-version": "2024-01-01",
            "access-control-allow-origin": "*",
            "access-control-expose-headers": "X-Supabase-Api-Version",
          },
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (path === "/auth/v1/token") {
        if (scenario.loginCode)
          return fulfill(
            { code: scenario.loginCode, msg: "Sign-in rejected" },
            400,
          );
        expect(req.postDataJSON().email).toBe("owner@example.com");
        return fulfill(session());
      }
      if (path === "/auth/v1/user") return fulfill(user());
      if (path === "/auth/v1/logout") return route.fulfill({ status: 204 });
      if (path === "/rest/v1/app_owner") {
        if (scenario.missingSchema)
          return fulfill({ code: "PGRST205", message: "Table missing" }, 404);
        return fulfill(scenario.nonOwner ? [] : [{ user_id: ownerId }]);
      }
      if (path === "/rest/v1/tracks" || path === "/rest/v1/playlists")
        return fulfill([]);
      throw new Error(`Unexpected Supabase request: ${req.method()} ${path}`);
    },
  );
}

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-not-a-real-account");
  await page.getByRole("button", { name: "Unlock my space" }).click();
}

for (const [code, message] of [
  ["invalid_credentials", "Email or password is incorrect"],
  ["email_not_confirmed", "email is not confirmed"],
]) {
  test(`explains ${code} and keeps the user at sign-in`, async ({ page }) => {
    await mockSupabase(page, { loginCode: code });
    await signIn(page);
    await expect(page.getByRole("status")).toContainText(message);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  });
}

test("distinguishes missing database setup from an unauthorized account", async ({
  page,
}) => {
  await mockSupabase(page, { missingSchema: true });
  await signIn(page);
  await expect(page.getByRole("status")).toContainText("supabase/schema.sql");
  await expect(
    page.getByRole("button", { name: "Unlock my space" }),
  ).toBeVisible();
});

test("rejects an authenticated account that is not the owner", async ({
  page,
}) => {
  await mockSupabase(page, { nonOwner: true });
  await signIn(page);
  await expect(page.getByRole("status")).toContainText("UUID in app_owner");
  await expect(
    page.getByRole("button", { name: "Upload files", exact: true }),
  ).toHaveCount(0);
});

for (const enrolled of [false, true]) {
  test(`owner enters with password only (existing factor: ${enrolled}) and signs out`, async ({
    page,
  }) => {
    await mockSupabase(page, { enrolled });
    await signIn(page);
    await expect(
      page.getByRole("button", { name: "Upload files", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Authenticator code")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Set up authenticator" }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Upload files", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Help and security" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Unlock my space" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Upload files", exact: true }),
    ).toHaveCount(0);
  });
}
