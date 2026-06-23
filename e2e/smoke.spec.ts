import { test, expect } from "@playwright/test"
import { login, creds } from "./helpers"

// Render smoke — always runs (no backend/creds needed). Guards that the login
// surface boots and the form is present.
test("login page renders with identifier + password", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByPlaceholder(/you@example\.com|9876543210/i)).toBeVisible()
  await expect(page.locator("#password")).toBeVisible()
})

// Full journey — login → home → create a post → see it in the feed. Needs a
// running stack + seeded user; skips otherwise.
test("login → create post → see it in feed", async ({ page }) => {
  const { email, password } = creds()
  test.skip(!email || !password, "set E2E_EMAIL / E2E_PASSWORD to run the authed journey")

  await login(page, email, password)

  const body = `e2e playwright post ${Date.now()}`

  // Open the composer (resilient: a Create/Post affordance exists in the shell).
  await page.getByRole("link", { name: /create|new post|compose/i }).first()
    .or(page.getByRole("button", { name: /create|new post|post/i }).first())
    .click()

  // Type the body into the editor and publish.
  await page.getByRole("textbox").first().fill(body)
  await page.getByRole("button", { name: /^post$|publish|share/i }).first().click()

  // The new post shows up in the feed.
  await expect(page.getByText(body)).toBeVisible({ timeout: 20_000 })
})
