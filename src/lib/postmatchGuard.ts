import { getSession } from '@/services/authService'
import { getPostMatchSession } from '@/lib/postmatchApi'

/**
 * PostMatch auth guard result.
 * - 'unauthenticated': user is NOT logged into Postbook — redirect to /login
 * - 'needs_onboarding': logged into Postbook but has no PostMatch profile — go to /postmatch/onboarding
 * - 'ready': fully authenticated and onboarded
 */
export type PostMatchAuthState = 'unauthenticated' | 'needs_onboarding' | 'ready'

export function checkPostMatchAuth(): PostMatchAuthState {
  const postbookSession = getSession()
  if (!postbookSession) return 'unauthenticated'

  const postmatchSession = getPostMatchSession()
  if (!postmatchSession || postmatchSession.onboarding_status !== 'ready') return 'needs_onboarding'

  return 'ready'
}

export function postmatchLoginRedirect(currentPath: string): string {
  const target = encodeURIComponent(currentPath)
  return `/login?redirect=${target}`
}
