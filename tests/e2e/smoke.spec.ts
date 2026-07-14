import { expect, test } from "@playwright/test";

test("home page responds successfully", async ({ page }) => {
  const response = await page.goto("/");

  expect(response, "expected a response from /").not.toBeNull();
  expect(response?.ok()).toBeTruthy();
});
