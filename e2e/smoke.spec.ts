/** Playwright E2E smoke（需本地 API + 前端 dev server）。 */

import { test, expect } from "@playwright/test";

test.describe("LiveEngage smoke", () => {
  test("API health", async ({ request }) => {
    const base = process.env.E2E_API_URL ?? "http://localhost:8000";
    const res = await request.get(`${base}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test("SSO config endpoint", async ({ request }) => {
    const base = process.env.E2E_API_URL ?? "http://localhost:8000";
    const res = await request.get(`${base}/api/v1/auth/sso/config`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("enabled");
  });
});
