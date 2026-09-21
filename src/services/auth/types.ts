import { User } from '@/types';

export type ApiGender = 'male' | 'female' | 'others';

export interface RegisterCommand {
  firstName: string;
  lastName: string;
  gender: ApiGender;
  dob: string;
  email: string;
  phone: string;
  password: string;
  /**
   * Must be explicitly true. auth-service refuses a registration that omits
   * it — a consent that defaults to granted is not consent — and records
   * `termsVersion` so a later audit can answer WHICH text was shown.
   */
  acceptedTerms: boolean;
  termsVersion: string;
}

export interface LoginCommand {
  identifier: string;
  password: string;
  deviceId: string;
  platform: string;
}

export interface AuthResult {
  user: User;
  accessToken?: string;
  /**
   * Only set on paths where the token still passes through JS — chiefly the
   * OAuth callback. The BFF auth routes strip it from their responses and put
   * it straight into an httpOnly cookie, so for login / 2FA / step-up this is
   * undefined by design. AuthSessionStore never persists it.
   */
  refreshToken?: string;
  /**
   * Issued by registration when the account still needs its email verified.
   *
   * /v1/auth/verify-email and /v1/auth/resend-verification BOTH require it:
   * they deliberately take no user id, because on a public route a
   * caller-supplied id would let anyone grind codes against any account
   * they can name. So the code alone is not enough — this scopes it to the
   * one account the server issued it for, and the flow cannot complete
   * without carrying it from registration to the verify screen.
   */
  verificationToken?: string;
}

export type StepUpMethod = 'email_otp' | 'totp';

export interface LoginResult {
  requires2FA: boolean;
  requiresStepUp?: boolean;
  pendingToken?: string;
  userId?: string;
  // Methods available when requiresStepUp=true (A13). Server fills based
  // on what's actually configured for the user: email-OTP needs a
  // verified email; totp needs 2FA enabled on the account.
  stepUpMethods?: StepUpMethod[];
  authResult?: AuthResult;
}

export interface LogoutCommand {
  /** Revoke every session for this user, not just this browser's. */
  allDevices?: boolean;
  /** Bearer token — /v1/auth/logout-all is authenticated. */
  accessToken?: string;
}

export interface LogoutResult {
  /** True only when the server confirmed the session was revoked. */
  serverRevoked: boolean;
}

export interface AuthStrategy {
  readonly name: string;
  register(command: RegisterCommand): Promise<AuthResult>;
  login(command: LoginCommand): Promise<LoginResult>;
  verify2FA(userId: string, code: string, pendingToken: string): Promise<AuthResult>;
  verifyStepUpEmail(pendingToken: string, code: string): Promise<AuthResult>;
  verifyStepUp2FA(pendingToken: string, code: string): Promise<AuthResult>;
  /**
   * Revoke the session server-side. Must never reject: the caller clears local
   * state regardless, and a failed revocation is reported through LogoutResult
   * rather than thrown, so a network error cannot trap someone in a session
   * they asked to end.
   */
  logout(command: LogoutCommand): Promise<LogoutResult>;
}
