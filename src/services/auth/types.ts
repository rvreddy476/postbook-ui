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
  refreshToken?: string;
}

export interface LoginResult {
  requires2FA: boolean;
  pendingToken?: string;
  userId?: string;
  authResult?: AuthResult;
}

export interface AuthStrategy {
  readonly name: string;
  register(command: RegisterCommand): Promise<AuthResult>;
  login(command: LoginCommand): Promise<LoginResult>;
  verify2FA(userId: string, code: string, pendingToken: string): Promise<AuthResult>;
}
