import type { CommunityRole } from '@/types/communities'

const ROLE_RANK: Record<CommunityRole, number> = {
  owner: 7,
  admin: 6,
  moderator: 5,
  space_manager: 4,
  expert: 3,
  member: 2,
  pending: 1,
  outsider: 0,
}

export function roleRank(role: CommunityRole | string | undefined): number {
  return ROLE_RANK[(role ?? 'outsider') as CommunityRole] ?? 0
}

export function isAtLeast(viewerRole: string | undefined, minRole: CommunityRole): boolean {
  return roleRank(viewerRole) >= roleRank(minRole)
}

export function canManageRole(viewerRole: string | undefined, targetRole: string | undefined): boolean {
  return roleRank(viewerRole) > roleRank(targetRole)
}

export const ROLE_BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-amber-100 text-amber-800' },
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
  moderator: { label: 'Mod', color: 'bg-blue-100 text-blue-700' },
  space_manager: { label: 'Manager', color: 'bg-violet-100 text-violet-700' },
  expert: { label: 'Expert', color: 'bg-emerald-100 text-emerald-700' },
}
