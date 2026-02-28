import { User } from '@/types';
import { AuthResult } from '@/services/auth/types';

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Dict;
};

const getString = (source: Dict | null, keys: string[]) => {
  if (!source) {
    return undefined;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const toDisplayGender = (gender: string | undefined): User['gender'] => {
  if (!gender) {
    return undefined;
  }

  const normalized = gender.toLowerCase();
  if (normalized === 'male') {
    return 'Male';
  }
  if (normalized === 'female') {
    return 'Female';
  }
  return 'Others';
};

const getPrimaryPayload = (payload: unknown) => {
  const root = asDict(payload);
  if (!root) {
    return null;
  }

  const data = asDict(root.data);
  const result = asDict(root.result);
  return data ?? result ?? root;
};

const pickUserSource = (payload: unknown) => {
  const primary = getPrimaryPayload(payload);
  if (!primary) {
    return null;
  }

  const directUser = asDict(primary.user);
  const profileUser = asDict(primary.profile);
  return directUser ?? profileUser ?? primary;
};

const getTokens = (payload: unknown) => {
  const primary = getPrimaryPayload(payload);
  if (!primary) {
    return { accessToken: undefined, refreshToken: undefined };
  }

  const tokenSource = asDict(primary.tokens) ?? primary;

  return {
    accessToken: getString(tokenSource, ['access_token', 'accessToken', 'token']),
    refreshToken: getString(tokenSource, ['refresh_token', 'refreshToken']),
  };
};

export const mapAuthResponse = (payload: unknown, fallbackIdentifier: string): AuthResult => {
  const userSource = pickUserSource(payload);

  const firstName = getString(userSource, ['first_name', 'firstName']);
  const lastName = getString(userSource, ['last_name', 'lastName']);
  const fullName = getString(userSource, ['name', 'full_name', 'fullName']) ?? [firstName, lastName].filter(Boolean).join(' ').trim();
  const userId =
    getString(userSource, ['id', 'user_id', 'userId', 'uuid']) ??
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `u_${Date.now()}`);
  const email = getString(userSource, ['email']);
  const phone = getString(userSource, ['phone']);
  const avatar =
    getString(userSource, ['avatar', 'avatar_url', 'avatarUrl', 'profile_image', 'profileImage']) ??
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName || fallbackIdentifier || userId)}`;

  const user: User = {
    id: userId,
    name: fullName || email || phone || fallbackIdentifier || 'PostBoek.com User',
    firstName,
    lastName,
    loginId: email || phone || fallbackIdentifier,
    gender: toDisplayGender(getString(userSource, ['gender'])),
    dob: getString(userSource, ['dob', 'date_of_birth', 'birth_date', 'birthDate']),
    avatar,
    isOnline: true,
    joinDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };

  const tokens = getTokens(payload);

  return {
    user,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};
