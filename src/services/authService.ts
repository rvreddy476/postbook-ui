import { User } from '@/types';
import { AuthRepository } from '@/services/auth/AuthRepository';
import { AuthSessionStore } from '@/services/auth/AuthSessionStore';
import { ApiGender } from '@/services/auth/types';
import { createAuthStrategy } from '@/services/auth/strategyFactory';
import { HttpClientError } from '@/services/core/httpClient';

interface RegisterPayload {
  firstName: string;
  lastName: string;
  gender: 'Male' | 'Female' | 'Others';
  dob: string;
  loginId: string;
  password: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
const DEVICE_ID_KEY = 'postbook_device_id';

const authRepository = new AuthRepository(createAuthStrategy(), new AuthSessionStore());

const mapGender = (gender: RegisterPayload['gender']): ApiGender => {
  switch (gender) {
    case 'Male':
      return 'male';
    case 'Female':
      return 'female';
    case 'Others':
    default:
      return 'others';
  }
};

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();

const isEmail = (value: string) => /.+@.+\..+/.test(value);

const getDeviceId = () => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'web-server';
  }

  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) {
      return existing;
    }

    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return 'web-fallback';
  }
};

const CODE_MESSAGES: Record<string, string> = {
  USER_EXISTS:          'An account with this email or phone already exists. Try logging in instead.',
  EMAIL_EXISTS:         'This email is already registered. Try logging in instead.',
  PHONE_EXISTS:         'This phone number is already registered. Try logging in instead.',
  AUTH_FAILED:          'Incorrect email/phone or password. Please try again.',
  INVALID_CREDENTIALS:  'Incorrect email/phone or password. Please try again.',
  ACCOUNT_LOCKED:       'Your account has been locked. Please contact support.',
  ACCOUNT_DISABLED:     'Your account has been disabled. Please contact support.',
  RATE_LIMITED:         'Too many attempts. Please wait a moment and try again.',
  RATE_LIMIT_EXCEEDED:  'Too many attempts. Please wait a moment and try again.',
  INVALID_TOKEN:        'Your session has expired. Please log in again.',
  TOKEN_EXPIRED:        'Your session has expired. Please log in again.',
  UNAUTHORIZED:         'You are not authorised to perform this action.',
}

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof HttpClientError) {
    // Log for debugging — never show request ID to users
    if (error.requestId) {
      console.error(`[Auth] Request ${error.requestId} failed:`, error.message, error.details);
    }
    // Map known backend error codes to friendly messages
    const details = error.details as Record<string, unknown> | undefined;
    const code = (details?.error as Record<string, unknown> | undefined)?.code as string | undefined;
    if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
    // Fall back to the message extracted from the response body
    return error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export const registerUser = async ({
  firstName,
  lastName,
  gender,
  dob,
  loginId,
  password,
}: RegisterPayload): Promise<{ success: boolean; error?: string; user?: User }> => {
  const identifier = normalizeIdentifier(loginId);

  if (!firstName.trim() || !lastName.trim() || !identifier || !password.trim() || !dob) {
    return { success: false, error: 'Please fill all required fields.' };
  }

  const email = isEmail(identifier) ? identifier : '';
  const phone = isEmail(identifier) ? '' : identifier;

  try {
    const user = await authRepository.register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender: mapGender(gender),
      dob,
      email,
      phone,
      password,
    });

    return { success: true, user };
  } catch (error) {
    console.error('[Auth] Registration failed:', error);
    return { success: false, error: toErrorMessage(error, 'Registration failed.') };
  }
};

export const loginUser = async (
  loginId: string,
  password: string
): Promise<{
  success: boolean;
  requires2FA?: boolean;
  requiresStepUp?: boolean;
  stepUpMethods?: ('email_otp' | 'totp')[];
  pendingToken?: string;
  userId?: string;
  error?: string;
  user?: User;
}> => {
  const identifier = normalizeIdentifier(loginId);

  if (!identifier || !password.trim()) {
    return { success: false, error: 'Identifier and password are required.' };
  }

  try {
    const loginResult = await authRepository.login({
      identifier,
      password,
      deviceId: getDeviceId(),
      platform: 'web',
    });

    if (loginResult.requiresStepUp) {
      return {
        success: true,
        requiresStepUp: true,
        stepUpMethods: loginResult.stepUpMethods,
        pendingToken: loginResult.pendingToken,
        userId: loginResult.userId,
      };
    }

    if (loginResult.requires2FA) {
      return {
        success: true,
        requires2FA: true,
        pendingToken: loginResult.pendingToken,
        userId: loginResult.userId,
      };
    }

    return { success: true, user: loginResult.authResult?.user };
  } catch (error) {
    console.error('[Auth] Login failed:', error);
    return { success: false, error: toErrorMessage(error, 'Authentication failed.') };
  }
};

export const verify2FA = async (
  userId: string,
  code: string,
  pendingToken: string
): Promise<{ success: boolean; error?: string; user?: User }> => {
  if (!userId || !code.trim() || !pendingToken) {
    return { success: false, error: 'Verification code is required.' };
  }

  try {
    const user = await authRepository.verify2FA(userId, code.trim(), pendingToken);
    return { success: true, user };
  } catch (error) {
    console.error('[Auth] 2FA verification failed:', error);
    return { success: false, error: toErrorMessage(error, 'Verification failed. Please try again.') };
  }
};

// A13 anomaly step-up. Two surfaces — email and 2FA — share the same
// response shape so the calling page can branch on the chosen method.
export const verifyStepUpEmail = async (
  pendingToken: string,
  code: string,
): Promise<{ success: boolean; error?: string; user?: User }> => {
  if (!pendingToken || !code.trim()) {
    return { success: false, error: 'Pending token and code are required.' };
  }
  try {
    const user = await authRepository.verifyStepUpEmail(pendingToken, code.trim());
    return { success: true, user };
  } catch (error) {
    console.error('[Auth] step-up email verify failed:', error);
    return { success: false, error: toErrorMessage(error, 'Verification failed. Please try again.') };
  }
};

export const verifyStepUp2FA = async (
  pendingToken: string,
  code: string,
): Promise<{ success: boolean; error?: string; user?: User }> => {
  if (!pendingToken || !code.trim()) {
    return { success: false, error: 'Pending token and code are required.' };
  }
  try {
    const user = await authRepository.verifyStepUp2FA(pendingToken, code.trim());
    return { success: true, user };
  } catch (error) {
    console.error('[Auth] step-up 2FA verify failed:', error);
    return { success: false, error: toErrorMessage(error, 'Verification failed. Please try again.') };
  }
};

export const getOAuthUrl = (provider: string): string => {
  return `${API_BASE_URL}/v1/auth/oauth/${provider}`;
};

export const updateUser = (updatedUser: User) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('postbook_session', JSON.stringify(updatedUser));
    window.dispatchEvent(new Event('postbook:session-changed'));
  } catch {
    // Ignore storage quota/corruption errors. Session update is best-effort.
  }
};

export const logoutUser = () => {
  authRepository.logout();
};

export const getSession = (): User | null => {
  return authRepository.getSessionUser();
};
