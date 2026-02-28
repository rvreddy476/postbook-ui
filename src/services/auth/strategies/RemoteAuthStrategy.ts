import { HttpClient } from '@/services/core/httpClient';
import { mapAuthResponse } from '@/services/auth/responseMapper';
import { AuthResult, AuthStrategy, LoginCommand, LoginResult, RegisterCommand } from '@/services/auth/types';

interface RegisterApiResponse {
  [key: string]: unknown;
}

interface LoginApiResponse {
  data?: {
    requires_2fa?: boolean;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8081';
const REGISTER_PATH = process.env.NEXT_PUBLIC_AUTH_REGISTER_PATH ?? '/v1/auth/register';
const LOGIN_PATH = process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH ?? '/v1/auth/login';
const VERIFY_2FA_PATH = '/v1/auth/2fa/verify';

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
    if (data?.requires_2fa) {
      const userSource = data.user;
      const userId =
        userSource?.id ?? userSource?.user_id ?? userSource?.userId ?? undefined;

      return {
        requires2FA: true,
        pendingToken: data.pending_token ?? undefined,
        userId: typeof userId === 'string' ? userId : undefined,
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
}
