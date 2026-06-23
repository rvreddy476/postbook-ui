import { Page, expect } from "@playwright/test"

// login drives the real /login form (identifier + password) and waits for the
// app to leave the login route. Mirrors src/app/login/page.tsx selectors:
// the identifier input carries the "you@example.com or 9876543210" placeholder
// and the password input is #password.
export async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login")
  await page.getByPlaceholder(/you@example\.com|9876543210/i).fill(identifier)
  await page.locator("#password").fill(password)
  await page.getByRole("button", { name: /log ?in|sign ?in|continue/i }).first().click()
  // Successful login navigates away from /login (to home/feed).
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

// creds reads test credentials from env; tests skip when absent so the suite is
// safe to run without a seeded user.
export function creds(prefix = "E2E") {
  return {
    email: process.env[`${prefix}_EMAIL`] || "",
    password: process.env[`${prefix}_PASSWORD`] || "",
  }
}
