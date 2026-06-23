import { test, expect } from "@playwright/test"
import { login, creds } from "./helpers"
import { randomUUID } from "node:crypto"

// Admin RBAC console smoke (the /admin/access page added with the RBAC API).
// Needs a superadmin (a user in the stack's SUPERADMIN_USER_IDS); skips otherwise.
test("superadmin can grant a role via /admin/access", async ({ page }) => {
  const { email, password } = creds("E2E_SUPERADMIN")
  test.skip(!email || !password, "set E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD to run the admin journey")

  await login(page, email, password)
  await page.goto("/admin/access")

  // The console renders (grant form present).
  await expect(page.getByRole("heading", { name: /access.*roles/i })).toBeVisible()

  const target = randomUUID()
  await page.getByPlaceholder(/user uuid/i).first().fill(target)
  await page.getByRole("combobox").selectOption("moderator")
  await page.getByRole("button", { name: /^grant$/i }).click()

  // A success notice confirms the grant (server enforces superadmin).
  await expect(page.getByText(/granted/i)).toBeVisible({ timeout: 15_000 })
})
