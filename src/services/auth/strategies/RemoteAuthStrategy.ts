import { HttpClient } from '@/services/core/httpClient';
import { mapAuthResponse } from '@/services/auth/responseMapper';
import {
  AuthResult,
  AuthStrategy,
  LoginCommand,
  LoginResult,
  LogoutCommand,
  LogoutResult,
  RegisterCommand,
  StepUpMethod,
} from '@/services/auth/types';

interface RegisterApiResponse {
  [key: string]: unknown;
}

interface LoginApiResponse {
  data?: {
    requires_2fa?: boolean;
    requires_step_up?: boolean;
    step_up_methods?: string[];
    pending_token?: string;
    user?: { id?: string; user_id?: string; userId?: string };
    tokens?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface Verify2FAApiResponse {
  [key: string]: unknown;
}

interface LogoutApiResponse {
  data?: {
    status?: string;
    server_revoked?: boolean;
  };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

/**
 * Every endpoint that can mint a session now goes through a same-origin BFF
 * route under /api/auth instead of straight at /v1/auth. Each route forwards
 * to the same gateway path the browser used to reach through the /v1/* →
 * /api/proxy/* rewrite, so the wire contract is unchanged — but it lifts the
 * refresh token out of the response into an httpOnly cookie, so the token
 * never enters JS on these paths.
 *
 * Endpoints that cannot mint a session (OAuth redirects, password reset) still
 * go direct; nothing sensitive is returned to JS there.
 */
const BFF_REGISTER_PATH = '/api/auth/register';
const BFF_LOGIN_PATH = '/api/auth/login';
const BFF_VERIFY_2FA_PATH = '/api/auth/2fa/verify';
const BFF_STEP_UP_EMAIL_PATH = '/api/auth/anomaly/verify-email';
const BFF_STEP_UP_2FA_PATH = '/api/auth/anomaly/verify-2fa';
const BFF_LOGOUT_PATH = '/api/auth/logout';

/**
 * Escape hatch, retained: if a deployment has pinned these it keeps talking
 * directly to the upstream. That path returns the refresh token to JS, where
 * AuthSessionStore hands it to /api/auth/session instead of storing it — so it
 * still does not land in localStorage, but it does transit the page.
 */
const DIRECT_REGISTER_PATH = process.env.NEXT_PUBLIC_AUTH_REGISTER_PATH;
const DIRECT_LOGIN_PATH = process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH;

export class RemoteAuthStrategy implements AuthStrategy {
  readonly name = 'remote';
  /** Talks to the upstream gateway directly. */
  private readonly httpClient: HttpClient;
  /** Same-origin, so the httpOnly session cookies attach and are honoured. */
  private readonly bffClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(API_BASE_URL, 10_000);
    this.bffClient = new HttpClient('', 15_000);
  }

  async register(command: RegisterCommand): Promise<AuthResult> {
    const payload = {
      phone: command.phone,
      email: command.email,
      password: command.password,
      first_name: command.firstName,
      last_name: command.lastName,
      dob: command.dob,
      gender: command.gender,
      // Without these two, auth-service answers 422 CONSENT_REQUIRED and
      // no account is created. They were missing, which is why
      // registration could not succeed at all.
      accepted_terms: command.acceptedTerms,
      terms_version: command.termsVersion,
    };

    const response = DIRECT_REGISTER_PATH
      ? await this.httpClient.post<RegisterApiResponse>(DIRECT_REGISTER_PATH, payload)
      : await this.bffClient.post<RegisterApiResponse>(BFF_REGISTER_PATH, payload);
    return mapAuthResponse(response, command.email || command.phone);
  }

  async login(command: LoginCommand): Promise<LoginResult> {
    const payload = {
      identifier: command.identifier,
      password: command.password,
      device_id: command.deviceId,
      platform: command.platform,
    };

    const response = DIRECT_LOGIN_PATH
      ? await this.httpClient.post<LoginApiResponse>(DIRECT_LOGIN_PATH, payload)
      : await this.bffClient.post<LoginApiResponse>(BFF_LOGIN_PATH, payload);

    const data = response.data;
    const userSource = data?.user;
    const userId =
      userSource?.id ?? userSource?.user_id ?? userSource?.userId ?? undefined;
    const userIdStr = typeof userId === 'string' ? userId : undefined;

    // A13 — anomaly enforcement envelope. When LOGIN_ANOMALY_ENFORCE is
    // 'enforce' and the login looks high-risk (new /24 + new device),
    // the server refuses to mint tokens and returns this envelope so
    // the UI can route to /auth/step-up. Falls through to a normal
    // session if the kill-switch is 'shadow' (the prod default).
    if (data?.requires_step_up) {
      const methods = (data.step_up_methods ?? []).filter(
        (m): m is StepUpMethod => m === 'email_otp' || m === 'totp',
      );
      return {
        requires2FA: false,
        requiresStepUp: true,
        pendingToken: data.pending_token ?? undefined,
        userId: userIdStr,
        stepUpMethods: methods,
      };
    }

    if (data?.requires_2fa) {
      return {
        requires2FA: true,
        pendingToken: data.pending_token ?? undefined,
        userId: userIdStr,
      };
    }

    const authResult = mapAuthResponse(response, command.identifier);
    return {
      requires2FA: false,
      authResult,
    };
  }

  async verify2FA(userId: string, code: string, pendingToken: string): Promise<AuthResult> {
    const payload = {
      user_id: userId,
      code,
      pending_token: pendingToken,
    };

    const response = await this.bffClient.post<Verify2FAApiResponse>(BFF_VERIFY_2FA_PATH, payload);
    return mapAuthResponse(response, userId);
  }

  async verifyStepUpEmail(pendingToken: string, code: string): Promise<AuthResult> {
    const response = await this.bffClient.post<Verify2FAApiResponse>(BFF_STEP_UP_EMAIL_PATH, {
      pending_token: pendingToken,
      code,
    });
    return mapAuthResponse(response, '');
  }

  async verifyStepUp2FA(pendingToken: string, code: string): Promise<AuthResult> {
    const response = await this.bffClient.post<Verify2FAApiResponse>(BFF_STEP_UP_2FA_PATH, {
      pending_token: pendingToken,
      code,
    });
    return mapAuthResponse(response, '');
  }

  /**
   * Revoke the session server-side via the BFF, which holds the refresh token
   * in its httpOnly cookie and clears it afterwards.
   *
   * Never rejects. The caller clears local state either way, so the only thing
   * a failure changes is whether we can honestly claim the server revoked
   * anything.
   */
  async logout(command: LogoutCommand): Promise<LogoutResult> {
    try {
      const headers: Record<string, string> = {};
      if (command.accessToken) {
        // Only /v1/auth/logout-all needs this; the BFF forwards it.
        headers.Authorization = `Bearer ${command.accessToken}`;
      }

      const response = await this.bffClient.post<LogoutApiResponse>(
        BFF_LOGOUT_PATH,
        { allDevices: command.allDevices === true },
        headers,
      );

      return { serverRevoked: response?.data?.server_revoked === true };
    } catch (error) {
      console.error('[Auth] server-side logout failed; clearing locally anyway:', error);
      return { serverRevoked: false };
    }
  }
}
