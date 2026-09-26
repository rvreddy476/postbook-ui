"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { getSession, loginUser, verify2FA } from "@/services/authService";
import { AuthAlert, AuthShell } from "@/components/auth/AuthShell";
import { authRedirect } from "@/components/auth/authRedirect";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell mode="login">
          <p role="status">Loading sign in…</p>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = authRedirect(searchParams.get("redirect"));
  const [screen, setScreen] = useState<"login" | "2fa">("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [userId, setUserId] = useState("");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const requestInFlight = useRef(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (getSession()) router.replace(redirectTo);
  }, [router, redirectTo]);
  useEffect(() => {
    if (screen === "2fa") codeInputRef.current?.focus();
  }, [screen, isRecoveryMode]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(null);
    setIsLoading(true);
    try {
      const result = await loginUser(loginId, password);
      if (!result.success) {
        setError(result.error || "Unable to sign in. Please try again.");
        return;
      }
      if (result.requiresStepUp) {
        const params = new URLSearchParams({
          pending_token: result.pendingToken ?? "",
          methods: (result.stepUpMethods ?? []).join(","),
          redirect: redirectTo,
        });
        router.push("/auth/step-up?" + params);
      } else if (result.requires2FA) {
        setPendingToken(result.pendingToken || "");
        setUserId(result.userId || "");
        setScreen("2fa");
      } else {
        router.push(redirectTo);
      }
    } catch {
      setError("We couldn’t connect. Please try again.");
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (requestInFlight.current || !twoFACode.trim()) return;
    requestInFlight.current = true;
    setTwoFAError(null);
    setIsVerifying(true);
    try {
      const result = await verify2FA(userId, twoFACode.trim(), pendingToken);
      if (result.success) router.push(redirectTo);
      else {
        setTwoFAError(result.error || "Verification failed. Please try again.");
        setTwoFACode("");
        codeInputRef.current?.focus();
      }
    } catch {
      setTwoFAError("We couldn’t connect. Please try again.");
    } finally {
      requestInFlight.current = false;
      setIsVerifying(false);
    }
  };

  return (
    <AuthShell mode="login">
      {screen === "login" ? (
        <>
          <div className="auth-form-heading">
            <span className="auth-step-label">Good to see you again</span>
            <h1 className="auth-title">Welcome back.</h1>
            <p className="auth-description">
              Pick up where you left off. Your people are here.
            </p>
          </div>
          {error && <AuthAlert id="login-error">{error}</AuthAlert>}
          <form
            className="auth-form"
            onSubmit={handleSubmit}
            aria-busy={isLoading}
            aria-describedby={error ? "login-error" : undefined}
          >
            <div className="auth-field">
              <label className="auth-label" htmlFor="loginId">
                Email or phone number
              </label>
              <input
                id="loginId"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="auth-input"
                placeholder="you@example.com or phone number"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="password">
                  Password
                </label>
                <Link href="/auth/forgot-password" className="auth-link">
                  Forgot password?
                </Link>
              </div>
              <div className="auth-password">
                <input
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button className="auth-primary" disabled={isLoading} type="submit">
              {isLoading && (
                <Loader2
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}
              {isLoading ? "Signing in…" : "Sign in"}
              {!isLoading && <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>
          <p className="auth-switch">
            New here?{" "}
            <Link className="auth-link" href="/register">
              Create an account
            </Link>
          </p>
        </>
      ) : (
        <>
          <button
            className="auth-back"
            type="button"
            disabled={isVerifying}
            onClick={() => {
              setScreen("login");
              setTwoFACode("");
              setTwoFAError(null);
              setIsRecoveryMode(false);
              setPendingToken("");
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to sign in
          </button>
          <div className="auth-verification-icon">
            <ShieldCheck size={25} aria-hidden="true" />
          </div>
          <div className="auth-form-heading">
            <h1 className="auth-title">One more step.</h1>
            <p className="auth-description">
              {isRecoveryMode
                ? "Enter one of your recovery codes to continue."
                : "Enter the 6-digit code from your authenticator app."}
            </p>
          </div>
          {twoFAError && (
            <AuthAlert id="verification-error">{twoFAError}</AuthAlert>
          )}
          <form
            className="auth-form"
            onSubmit={handleVerify}
            aria-busy={isVerifying}
          >
            <div className="auth-field">
              <label htmlFor="twoFACode" className="auth-label">
                {isRecoveryMode ? "Recovery code" : "Verification code"}
              </label>
              <input
                ref={codeInputRef}
                id="twoFACode"
                name="code"
                type="text"
                inputMode={isRecoveryMode ? "text" : "numeric"}
                autoComplete="one-time-code"
                className="auth-input auth-code"
                value={twoFACode}
                onChange={(e) =>
                  setTwoFACode(
                    isRecoveryMode
                      ? e.target.value
                      : e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                placeholder={isRecoveryMode ? "Recovery code" : "000000"}
                aria-invalid={!!twoFAError}
                aria-describedby={twoFAError ? "verification-error" : undefined}
                required
                disabled={isVerifying}
              />
            </div>
            <button
              className="auth-primary"
              disabled={
                isVerifying ||
                (isRecoveryMode ? !twoFACode.trim() : twoFACode.length !== 6)
              }
              type="submit"
            >
              {isVerifying && (
                <Loader2
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}
              {isVerifying ? "Verifying…" : "Verify and continue"}
            </button>
          </form>
          <div className="auth-switch">
            <button
              type="button"
              className="auth-link"
              disabled={isVerifying}
              onClick={() => {
                setIsRecoveryMode((v) => !v);
                setTwoFACode("");
                setTwoFAError(null);
              }}
            >
              {isRecoveryMode
                ? "Use an authenticator code"
                : "Use a recovery code"}
            </button>
          </div>
        </>
      )}
    </AuthShell>
  );
}
