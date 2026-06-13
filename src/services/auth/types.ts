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

export interface AuthStrategy {
  readonly name: string;
  register(command: RegisterCommand): Promise<AuthResult>;
  login(command: LoginCommand): Promise<LoginResult>;
  verify2FA(userId: string, code: string, pendingToken: string): Promise<AuthResult>;
  verifyStepUpEmail(pendingToken: string, code: string): Promise<AuthResult>;
  verifyStepUp2FA(pendingToken: string, code: string): Promise<AuthResult>;
}
