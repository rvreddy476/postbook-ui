"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Mail,
} from "lucide-react";
import { getSession, loginUser, registerUser } from "@/services/authService";
import { DobPicker, validateDob } from "@/components/ui/dob-picker";
import { useVerifyEmail, useResendVerification } from "@/hooks/useSecurity";
import { AuthAlert, AuthShell } from "@/components/auth/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<"register" | "verify-email">("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Others">("Male");
  const [dob, setDob] = useState("");
  const [dobError, setDobError] = useState<string | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // This is a credential: keep it in memory, never URLs or persistent storage.
  const [verificationToken, setVerificationToken] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);
  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();

  useEffect(() => {
    if (getSession()) router.replace("/");
  }, [router]);
  useEffect(() => {
    if (screen === "verify-email") codeInputRef.current?.focus();
  }, [screen]);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(
      () => setResendCooldown((value) => value - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // A successful challenge is not a session. Only navigate to the feed after
  // login has completed; MFA / step-up must still go through the login screen.
  const signInAfterRegistration = async () => {
    const result = await loginUser(loginId, password);
    router.replace(
      result.success && !result.requires2FA && !result.requiresStepUp
        ? "/"
        : "/login",
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (requestInFlight.current) return;
    setError(null);
    const invalidDob = validateDob(dob);
    setDobError(invalidDob);
    if (invalidDob) return;
    requestInFlight.current = true;
    setIsLoading(true);
    try {
      const result = await registerUser({
        firstName,
        lastName,
        gender,
        dob,
        loginId,
        password,
        acceptedTerms,
      });
      if (!result.success) {
        setError(
          result.error || "Unable to create your account. Please try again.",
        );
        return;
      }
      if (/.+@.+\..+/.test(loginId.trim())) {
        if (!result.verificationToken) {
          setError(
            "Account created, but verification could not start. Please sign in to request a new code.",
          );
          return;
        }
        setVerificationToken(result.verificationToken);
        setScreen("verify-email");
        setResendCooldown(60);
      } else {
        await signInAfterRegistration();
      }
    } catch {
      setError(
        "We couldn’t connect. Please try again, or sign in if your account was created.",
      );
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (requestInFlight.current || verifyCode.length !== 6) return;
    requestInFlight.current = true;
    setVerifyError(null);
    let verified = false;
    try {
      await verifyEmail.mutateAsync({ verificationToken, code: verifyCode });
      verified = true;
      setVerifySuccess(true);
      await signInAfterRegistration();
    } catch {
      if (verified) router.replace("/login");
      else {
        setVerifyError(
          "We couldn’t verify that code. Check it and try again, or request a new one.",
        );
        codeInputRef.current?.focus();
      }
    } finally {
      requestInFlight.current = false;
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || requestInFlight.current) return;
    requestInFlight.current = true;
    setVerifyError(null);
    setResendNotice("");
    try {
      await resendVerification.mutateAsync({
        type: "email",
        verificationToken,
      });
      setResendCooldown(60);
      setResendNotice("A new code has been sent. Check your inbox.");
    } catch {
      setVerifyError("We couldn’t resend the code. Please try again.");
    } finally {
      requestInFlight.current = false;
    }
  };

  return (
    <AuthShell mode="register">
      {screen === "register" ? (
        <>
          <div className="auth-form-heading">
            <span className="auth-step-label">
              Your next chapter starts here
            </span>
            <h1 className="auth-title">Make yourself at home.</h1>
            <p className="auth-description">
              Create your account and find your kind of connection.
            </p>
          </div>
          {error && <AuthAlert id="registration-error">{error}</AuthAlert>}
          <form
            id="registration-form"
            className="auth-form"
            onSubmit={handleSubmit}
            aria-busy={isLoading}
            aria-describedby={error ? "registration-error" : undefined}
          >
            <fieldset disabled={isLoading} className="auth-form min-w-0">
              <legend className="sr-only">Your account details</legend>
              <div className="auth-name-row">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="given-name"
                    autoComplete="given-name"
                    className="auth-input"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="family-name"
                    autoComplete="family-name"
                    className="auth-input"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
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
                />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="password">
                  Password
                </label>
                <div className="auth-password">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="auth-input"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <fieldset className="auth-field min-w-0">
                <legend className="auth-label mb-2">Date of birth</legend>
                <DobPicker
                  value={dob}
                  onChange={(value) => {
                    setDob(value);
                    setDobError(null);
                  }}
                  error={dobError ?? undefined}
                  selectClassName="auth-input"
                  className="auth-birthday"
                  required
                />
              </fieldset>
              <fieldset className="auth-field">
                <legend className="auth-label mb-2">Gender</legend>
                <div className="auth-gender">
                  {(["Male", "Female", "Others"] as const).map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="gender"
                        value={value}
                        checked={gender === value}
                        onChange={() => setGender(value)}
                      />
                      {value === "Others" ? "Other" : value}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="auth-consent">
                <input
                  type="checkbox"
                  name="acceptedTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  required
                />
                <span>
                  I agree to the{" "}
                  <Link
                    className="auth-link"
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    className="auth-link"
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              <button
                type="submit"
                className="auth-primary"
                disabled={isLoading || !acceptedTerms}
              >
                {isLoading && (
                  <Loader2
                    size={18}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isLoading ? "Creating your account…" : "Create account"}
                {!isLoading && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </fieldset>
          </form>
          <p className="auth-switch">
            Already part of VChat?{" "}
            <Link className="auth-link" href="/login">
              Sign in
            </Link>
          </p>
        </>
      ) : verifySuccess ? (
        <div className="auth-success" role="status">
          <CheckCircle size={48} aria-hidden="true" />
          <h1 className="auth-title">You’re all set.</h1>
          <p className="auth-description">
            Email verified. Finishing your sign-in…
          </p>
          <Link href="/login" className="auth-link mt-5 inline-block">
            Continue to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="auth-verification-icon">
            <Mail size={25} aria-hidden="true" />
          </div>
          <div className="auth-form-heading">
            <span className="auth-step-label">Verify your email</span>
            <h1 className="auth-title">Check your inbox.</h1>
            <p className="auth-description">
              Enter the 6-digit code sent to{" "}
              <strong className="text-brand-text">{loginId}</strong>.
            </p>
          </div>
          {verifyError && (
            <AuthAlert id="verify-error">{verifyError}</AuthAlert>
          )}
          <form
            className="auth-form"
            onSubmit={handleVerifyEmail}
            aria-busy={verifyEmail.isPending}
          >
            <div className="auth-field">
              <label className="auth-label" htmlFor="verifyCode">
                Verification code
              </label>
              <input
                ref={codeInputRef}
                id="verifyCode"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="auth-input auth-code"
                placeholder="000000"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => {
                  setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setVerifyError(null);
                }}
                aria-invalid={!!verifyError}
                aria-describedby={verifyError ? "verify-error" : undefined}
                required
                disabled={verifyEmail.isPending}
              />
            </div>
            <button
              type="submit"
              className="auth-primary"
              disabled={
                verifyEmail.isPending ||
                resendVerification.isPending ||
                verifyCode.length !== 6
              }
            >
              {verifyEmail.isPending && (
                <Loader2
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}
              {verifyEmail.isPending ? "Verifying…" : "Verify email"}
            </button>
          </form>
          <p role="status" className="auth-hint mt-4">
            {resendNotice}
          </p>
          <div className="auth-switch">
            <p className="mb-2">
              Didn’t receive a code? Check your spam folder.
            </p>
            <button
              type="button"
              className="auth-link min-h-11 disabled:opacity-60"
              disabled={
                resendCooldown > 0 ||
                resendVerification.isPending ||
                verifyEmail.isPending
              }
              onClick={handleResendCode}
            >
              {resendCooldown > 0
                ? "Resend in " + resendCooldown + "s"
                : resendVerification.isPending
                  ? "Sending…"
                  : "Resend code"}
            </button>
            <p className="auth-hint mt-3">
              Returning later?{" "}
              <Link className="auth-link" href="/login">
                Sign in to continue verification
              </Link>
              .
            </p>
          </div>
        </>
      )}
    </AuthShell>
  );
}
