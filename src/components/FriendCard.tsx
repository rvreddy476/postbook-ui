'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Users, UserPlus, X } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-orange-500',
];

function initialColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initial(name: string): string {
  return (name?.charAt(0) || '?').toUpperCase();
}

function avatarUrl(mediaId?: string): string | null {
  if (!mediaId) return null;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  return `${base}/v1/media/${mediaId}/serve`;
}

export interface FriendCardProps {
  userId: string;
  displayName: string;
  username?: string;
  avatarMediaId?: string;
  /** Mutual friend count (rendered when ≥ 1). */
  mutualFriendCount?: number;
  /** Optional avatar IDs for the small overlapping mutual-friend stack. */
  mutualFriendIds?: string[];
  /** Reason codes from suggestion-service (LOCATION, MUTUAL_FRIENDS, FOF, …). */
  reasonCodes?: string[];
  /** Primary CTA label (e.g. "Add Friend" / "Confirm"). */
  primaryLabel: string;
  /** Optional Lucide icon component for the primary button (default: UserPlus). */
  primaryIcon?: React.ComponentType<{ className?: string }>;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Secondary CTA label — used for the small text under the avatar
   *  ("Delete"/"Remove" surface on the × button). */
  secondaryLabel: string;
  onSecondary: () => void;
  secondaryDisabled?: boolean;
}

/**
 * Suggestion / friend-request card in the VChat cream-and-blue style.
 * Layout (matches design handoff):
 *   ┌─────────────────────────────────────────┐
 *   │ [Avatar] **Name**                  [×]  │
 *   │          📍 Same city                   │
 *   │          👥 N mutual friends            │
 *   │          ┌──────────────┐ ┌────┐        │
 *   │          │ Add Friend   │ │ +  │        │
 *   │          └──────────────┘ └────┘        │
 *   └─────────────────────────────────────────┘
 *
 * Dark primary button + small outline secondary button next to it.
 * × in the top-right calls onSecondary (the "Remove/Delete" action).
 */
export default function FriendCard({
  userId,
  displayName,
  username,
  avatarMediaId,
  mutualFriendCount,
  mutualFriendIds,
  reasonCodes,
  primaryLabel,
  primaryIcon: PrimaryIcon = UserPlus,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
}: FriendCardProps) {
  const profileHref = username ? `/u/${username}` : `/profile?id=${userId}`;
  const src = avatarUrl(avatarMediaId);
  const showMutual = (mutualFriendCount ?? 0) > 0;
  const mutualAvatars = (mutualFriendIds ?? []).slice(0, 3);
  const sameCity = (reasonCodes ?? []).some(
    (r) => r === 'LOCATION' || r === 'location' || r === 'SAME_CITY',
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="relative rounded-2xl bg-white px-4 py-3 shadow-sm border border-black/[0.03]"
    >
      {/* × dismiss in the top-right — invokes the secondary action
          (Remove/Delete). Floating outside the column flow. */}
      <button
        type="button"
        onClick={onSecondary}
        disabled={secondaryDisabled}
        aria-label={secondaryLabel}
        title={secondaryLabel}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-[#6b6b6b] hover:bg-[#F6F3EC] disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <Link
          href={profileHref}
          aria-label={displayName}
          className="shrink-0"
        >
          <div className="h-14 w-14 overflow-hidden rounded-full">
            {src ? (
              <img src={src} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className={`flex h-full w-full items-center justify-center text-white text-xl font-bold ${initialColor(userId)}`}>
                {initial(displayName)}
              </div>
            )}
          </div>
        </Link>

        <div className="min-w-0 flex-1 pr-6">
          <Link href={profileHref}>
            <div className="truncate text-[14px] font-bold leading-tight text-[#111] hover:text-[#2563EB] transition-colors">
              {displayName}
            </div>
          </Link>

          {/* Reason rows — render whatever signals the candidate has. */}
          <div className="mt-1 space-y-0.5">
            {sameCity && (
              <div className="flex items-center gap-1 text-[11.5px] text-[#6b6b6b]">
                <MapPin className="h-3 w-3" />
                Same city
              </div>
            )}
            {showMutual && (
              <div className="flex items-center gap-1 text-[11.5px] text-[#6b6b6b]">
                {mutualAvatars.length > 0 ? (
                  <div className="flex -space-x-1 mr-0.5">
                    {mutualAvatars.map((id) => {
                      const mSrc = avatarUrl(id);
                      return (
                        <div
                          key={id}
                          className="h-3.5 w-3.5 overflow-hidden rounded-full border border-white bg-[#F6F3EC]"
                        >
                          {mSrc ? (
                            <img src={mSrc} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Users className="h-3 w-3" />
                )}
                {mutualFriendCount} mutual {mutualFriendCount === 1 ? 'friend' : 'friends'}
              </div>
            )}
            {!sameCity && !showMutual && username && (
              <div className="text-[11.5px] text-[#aaa]">@{username}</div>
            )}
          </div>
        </div>
      </div>

      {/* Action row — dark primary button stretches the full card width. */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#111] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#222] disabled:opacity-40"
        >
          <PrimaryIcon className="h-3.5 w-3.5" />
          {primaryLoading ? '…' : primaryLabel}
        </button>
      </div>
    </motion.div>
  );
}
