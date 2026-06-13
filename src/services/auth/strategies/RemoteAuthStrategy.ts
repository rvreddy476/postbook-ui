import { HttpClient } from '@/services/core/httpClient';
import { mapAuthResponse } from '@/services/auth/responseMapper';
import { AuthResult, AuthStrategy, LoginCommand, LoginResult, RegisterCommand, StepUpMethod } from '@/services/auth/types';

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
const REGISTER_PATH = process.env.NEXT_PUBLIC_AUTH_REGISTER_PATH ?? '/v1/auth/register';
const LOGIN_PATH = process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH ?? '/v1/auth/login';
const VERIFY_2FA_PATH = '/v1/auth/2fa/verify';
const STEP_UP_EMAIL_PATH = '/v1/auth/anomaly/verify-email';
const STEP_UP_2FA_PATH = '/v1/auth/anomaly/verify-2fa';

export class RemoteAuthStrategy implements AuthStrategy {
  readonly name = 'remote';
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(API_BASE_URL, 10_000);
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
    };

    const response = await this.httpClient.post<RegisterApiResponse>(REGISTER_PATH, payload);
    return mapAuthResponse(response, command.email || command.phone);
  }

  async login(command: LoginCommand): Promise<LoginResult> {
    const payload = {
      identifier: command.identifier,
      password: command.password,
      device_id: command.deviceId,
      platform: command.platform,
    };

    const response = await this.httpClient.post<LoginApiResponse>(LOGIN_PATH, payload);

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

    const response = await this.httpClient.post<Verify2FAApiResponse>(VERIFY_2FA_PATH, payload);
    return mapAuthResponse(response, userId);
  }

  async verifyStepUpEmail(pendingToken: string, code: string): Promise<AuthResult> {
    const response = await this.httpClient.post<Verify2FAApiResponse>(STEP_UP_EMAIL_PATH, {
      pending_token: pendingToken,
      code,
    });
    return mapAuthResponse(response, '');
  }

  async verifyStepUp2FA(pendingToken: string, code: string): Promise<AuthResult> {
    const response = await this.httpClient.post<Verify2FAApiResponse>(STEP_UP_2FA_PATH, {
      pending_token: pendingToken,
      code,
    });
    return mapAuthResponse(response, '');
  }
}
