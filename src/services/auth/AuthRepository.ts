import { AuthSessionStore } from '@/services/auth/AuthSessionStore';
import { AuthStrategy, LoginCommand, LoginResult, RegisterCommand } from '@/services/auth/types';

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

    if (loginResult.requires2FA) {
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

  getSessionUser() {
    return this.sessionStore.getUser();
  }

  logout() {
    this.sessionStore.clear();
  }
}
