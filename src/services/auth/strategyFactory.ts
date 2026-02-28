import { RemoteAuthStrategy } from '@/services/auth/strategies/RemoteAuthStrategy';

export const createAuthStrategy = () => {
  const strategy = (process.env.NEXT_PUBLIC_AUTH_STRATEGY ?? 'remote').toLowerCase();

  switch (strategy) {
    case 'remote':
    default:
      return new RemoteAuthStrategy();
  }
};
