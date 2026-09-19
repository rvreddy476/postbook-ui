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
