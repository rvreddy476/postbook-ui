import { User } from '@/types';
import { AuthResult } from '@/services/auth/types';

const SESSION_KEY = 'postbook_session';
const TOKEN_KEY = 'postbook_auth_tokens';
const SESSION_CHANGE_EVENT = 'postbook:session-changed';

/**
 * What still lives in localStorage, and why.
 *
 * The refresh token used to be here. It is the highest-value thing an
 * injected script could steal: long-lived, and enough to mint access tokens
 * indefinitely. It now lives in an httpOnly cookie set by the BFF routes
 * under /api/auth (see src/app/api/auth/_lib/session.ts) and is never
 * written here again.
 *
 * The access token stays, deliberately. It is short-lived, and several
 * surfaces outside this lane read it from this exact key — the notification
 * socket, messageService, useActivityNotifications, useAggregatedProfile.
 * Moving it to memory as well (what src/lib/postmatchApi.ts does for
 * PostMatch) means changing all of those, which belongs in a follow-up.
 */
interface TokenRecord {
  accessToken?: string;
  updatedAt: number;
}

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const emitSessionChange = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
};

/**
 * Hand a refresh token that arrived in JS to the server, which stores it in
 * the httpOnly cookie. Used by paths that do not go through the BFF login
 * routes — chiefly the OAuth callback page, which builds its AuthResult
 * itself and lives outside this lane's file scope.
 *
 * Fire-and-forget on purpose: callers are synchronous, and both OAuth pages
 * navigate to "/" (a public route) immediately afterwards, so the cookie has
 * landed well before the first gated navigation. Failure is logged, not
 * thrown — a session that cannot be refreshed is still a usable session until
 * the access token expires.
 */
const adoptRefreshToken = (accessToken?: string, refreshToken?: string) => {
  if (typeof fetch === 'undefined' || !accessToken || !refreshToken) {
    return;
  }

  void fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, refreshToken }),
  }).catch(() => {
    console.error('[Auth] could not move the refresh token into its cookie');
  });
};

export class AuthSessionStore {
  save(result: AuthResult) {
    if (!canUseStorage()) {
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));

    // Note what is NOT here: result.refreshToken. When the session came
    // through a BFF route it is already undefined (the route stripped it from
    // the response). When it came from OAuth it is still in memory, so it is
    // handed to the cookie and dropped.
    const tokenRecord: TokenRecord = {
      accessToken: result.accessToken,
      updatedAt: Date.now(),
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenRecord));

    adoptRefreshToken(result.accessToken, result.refreshToken);

    emitSessionChange();
  }

  getUser(): User | null {
    if (!canUseStorage()) {
      return null;
    }

    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
      return null;
    }

    try {
      return JSON.parse(session) as User;
    } catch {
      this.clear();
      return null;
    }
  }

  getAccessToken(): string | null {
    if (!canUseStorage()) {
      return null;
    }

    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) {
        return null;
      }
      const record = JSON.parse(raw) as TokenRecord;
      return record.accessToken ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Drop the local session. Does not call the server — AuthRepository.logout()
   * owns that, and the /api/auth/logout route clears the cookies as part of
   * it. Kept local-only so the parse-error path in getUser() cannot
   * accidentally revoke a live session.
   */
  clear() {
    if (!canUseStorage()) {
      return;
    }

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    emitSessionChange();
  }
}
