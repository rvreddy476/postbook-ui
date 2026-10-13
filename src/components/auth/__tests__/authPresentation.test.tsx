import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthAlert, AuthShell } from "../AuthShell";
import { authRedirect } from "../authRedirect";

describe("auth presentation", () => {
  test("shared shell provides named region, skip link, appearance control and real legal links", () => {
    const html = renderToStaticMarkup(
      <AuthShell mode="login">
        <h1>Sign in</h1>
      </AuthShell>,
    );
    expect(html).toContain('href="#auth-form"');
    expect(html).toContain('aria-label="Sign in to VChat"');
    expect(html).toContain("Switch to dark theme");
    expect(html).toContain('href="/register"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
  });
  test("registration shell points returning users to sign in", () => {
    const html = renderToStaticMarkup(
      <AuthShell mode="register">Register</AuthShell>,
    );
    expect(html).toContain('aria-label="Create your VChat account"');
    expect(html).toContain('href="/login"');
  });
  test("auth header keeps a safe partner destination through mode switches", () => {
    expect(renderToStaticMarkup(<AuthShell mode="login" redirectTo="/doorstep/partner">Sign in</AuthShell>)).toContain('href="/register?redirect=%2Fdoorstep%2Fpartner"');
    expect(renderToStaticMarkup(<AuthShell mode="register" redirectTo="/doorstep/partner">Register</AuthShell>)).toContain('href="/login?redirect=%2Fdoorstep%2Fpartner"');
    expect(renderToStaticMarkup(<AuthShell mode="register" redirectTo="//outside.example">Register</AuthShell>)).toContain('href="/login"');
  });
  test("errors announce themselves and escape server messages", () => {
    const html = renderToStaticMarkup(
      <AuthAlert id="error">{"<script>bad</script>"}</AuthAlert>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('id="error"');
    expect(html).not.toContain("<script>");
  });
});

describe("auth return paths", () => {
  test("preserves internal paths and their query", () => {
    expect(authRedirect("/groups/123?tab=members")).toBe(
      "/groups/123?tab=members",
    );
  });
  test.each([
    null,
    "",
    "//outside.example",
    "/\\outside.example",
    "javascript:alert(1)",
    "https://outside.example",
    "/\n/outside.example",
  ])("refuses unsafe destination %s", (value) => {
    expect(authRedirect(value)).toBe("/");
  });
});
