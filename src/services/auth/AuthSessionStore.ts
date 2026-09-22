import { User } from '@/types';
import { AuthResult } from '@/services/auth/types';
import {
  clearAccessToken,
  peekAccessToken,
  purgeLegacyTokenStorage,
  setAccessToken,
} from '@/lib/accessToken';

const SESSION_KEY = 'postbook_session';
const SESSION_CHANGE_EVENT = 'postbook:session-changed';

/**
 * What still lives in localStorage, and what deliberately does not.
 *
 * Neither token is here any more.
 *
 * The refresh token lives in an httpOnly cookie set by the BFF routes under
 * /api/auth (src/app/api/auth/_lib/session.ts). The access token lives in a
 * module variable in src/lib/accessToken.ts, minted from that cookie on
 * demand. Both were once readable by any injected script, which made one XSS
 * anywhere in the app — or in anything it loads — enough to lift a
 * replayable session.
 *
 * What remains under `postbook_session` is the User object, so a name and an
 * avatar render without a round trip. It is not a credential and proves
 * nothing to the server: it is a CACHE of the session, never its authority.
 * The refresh cookie is the authority, which is what stops the two drifting
 * apart the way they used to.
 */

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

    // Neither token is written to storage. The access token goes to memory;
    // the refresh token goes to the httpOnly cookie via adoptRefreshToken and
    // is then dropped. When the session came through a BFF route the refresh
    // token is already undefined here (the route stripped it from the
    // response before it reached JS at all).
    setAccessToken(result.accessToken ?? null);
    purgeLegacyTokenStorage();

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

  /**
   * The in-memory access token, if one has been minted in this tab.
   *
   * Synchronous, and may be null on a cold tab before the first refresh.
   * The only caller is logout, where a null token simply means the
   * "sign out everywhere" variant cannot be attempted — the single-session
   * revocation rides the refresh cookie and works regardless.
   */
  getAccessToken(): string | null {
    return peekAccessToken();
  }

  /**
   * Drop the local session. Does not call the server — AuthRepository.logout()
   * owns that, and the /api/auth/logout route clears the cookies as part of
   * it. Kept local-only so the parse-error path in getUser() cannot
   * accidentally revoke a live session.
   */
  clear() {
    // The in-memory token first, and unconditionally: it exists even where
    // localStorage does not, and leaving it behind would keep this tab
    // authenticated after a sign-out.
    clearAccessToken();

    if (!canUseStorage()) {
      return;
    }

    localStorage.removeItem(SESSION_KEY);
    purgeLegacyTokenStorage();
    emitSessionChange();
  }
}
