import { AuthSessionStore } from '@/services/auth/AuthSessionStore';
import {
  AuthStrategy,
  LoginCommand,
  LoginResult,
  LogoutResult,
  RegisterCommand,
} from '@/services/auth/types';

export class AuthRepository {
  private readonly strategy: AuthStrategy;
  private readonly sessionStore: AuthSessionStore;

  constructor(strategy: AuthStrategy, sessionStore: AuthSessionStore) {
    this.strategy = strategy;
    this.sessionStore = sessionStore;
  }

  async register(command: RegisterCommand) {
    const result = await this.strategy.register(command);
    this.sessionStore.save(result);
    return result.user;
  }

  async login(command: LoginCommand): Promise<LoginResult> {
    const loginResult = await this.strategy.login(command);

    if (loginResult.requires2FA || loginResult.requiresStepUp) {
      return loginResult;
    }

    if (loginResult.authResult) {
      this.sessionStore.save(loginResult.authResult);
    }

    return loginResult;
  }

  async verify2FA(userId: string, code: string, pendingToken: string) {
    const authResult = await this.strategy.verify2FA(userId, code, pendingToken);
    this.sessionStore.save(authResult);
    return authResult.user;
  }

  async verifyStepUpEmail(pendingToken: string, code: string) {
    const authResult = await this.strategy.verifyStepUpEmail(pendingToken, code);
    this.sessionStore.save(authResult);
    return authResult.user;
  }

  async verifyStepUp2FA(pendingToken: string, code: string) {
    const authResult = await this.strategy.verifyStepUp2FA(pendingToken, code);
    this.sessionStore.save(authResult);
    return authResult.user;
  }

  getSessionUser() {
    return this.sessionStore.getUser();
  }

  /**
   * End the session on the server, then locally.
   *
   * This used to clear localStorage and nothing else, so the refresh token
   * stayed valid server-side: someone who had "signed out" still had a live
   * session that a stolen token could ride.
   *
   * Two properties this has to hold, and the ordering is deliberate:
   *
   *  - The local clear ALWAYS happens, even when the network call fails or
   *    the server is down. A user who asks to sign out is signed out of this
   *    browser regardless. It runs synchronously, before the returned promise
   *    settles, so a caller that does not await — logoutUser() in
   *    authService.ts is synchronous — still sees the session gone
   *    immediately. Otherwise the login page's "already signed in" check
   *    would bounce them straight back into the app.
   *  - The server call is started BEFORE the clear, because it needs the
   *    access token that the clear is about to delete.
   *
   * The returned promise resolves to whether the server confirmed revocation.
   * It never rejects.
   */
  logout(command: { allDevices?: boolean } = {}): Promise<LogoutResult> {
    const accessToken = this.sessionStore.getAccessToken() ?? undefined;

    // Started first: reads the token the clear below removes.
    const revocation = this.strategy.logout({
      allDevices: command.allDevices,
      accessToken,
    });

    this.sessionStore.clear();

    return revocation;
  }
}
