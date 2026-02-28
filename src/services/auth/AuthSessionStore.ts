import { User } from '@/types';
import { AuthResult } from '@/services/auth/types';

const SESSION_KEY = 'postbook_session';
const TOKEN_KEY = 'postbook_auth_tokens';

interface TokenRecord {
  accessToken?: string;
  refreshToken?: string;
  updatedAt: number;
}

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export class AuthSessionStore {
  save(result: AuthResult) {
    if (!canUseStorage()) {
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));

    const tokenRecord: TokenRecord = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      updatedAt: Date.now(),
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenRecord));
  }

  getUser(): User | null {
    if (!canUseStorage()) {
      return null;
    }

    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
      return null;
    }

    return JSON.parse(session) as User;
  }

  clear() {
    if (!canUseStorage()) {
      return;
    }

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}
