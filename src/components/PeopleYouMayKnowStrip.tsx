'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, UserPlus, Users, X } from 'lucide-react';

import { useAuthUser } from '@/store/auth';
import {
  useFriendSuggestions,
  useHideSuggestion,
  useBatchRelationships,
} from '@/hooks/useConnections';
import { useFollowUser, useUnfollowUser } from '@/hooks/useEditProfile';
import { followLabel, type FollowState } from '@/features/reels/explore/SuggestedCreators';
import { useSentRequests } from '@/hooks/useSentRequests';
import { suggestionMetaLine } from '@/lib/suggestionReason';

interface PeopleYouMayKnowStripProps {
  /** Which slice of the suggestion list this strip instance shows —
   *  lets a second strip deeper in the feed show different people. */
  offset?: number;
}

/**
 * Follow / Following on a suggestion card. Connect is gone (founder, 24 Oct
 * 2026): a suggestion offers Follow, the graph-service follow; a private
 * account turns it into a request.
 */
export function SuggestionFollowButton({
  userId,
  name,
  following,
  variant = 'card',
}: {
  userId: string
  name: string
  following: boolean
  /** `card` fills a suggestion card; `row` sits at the end of a list row. */
  variant?: 'card' | 'row'
}) {
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();
  const [local, setLocal] = useState<FollowState | null>(null);
  const state: FollowState = local ?? (following ? 'following' : 'none');
  const busy = follow.isPending || unfollow.isPending;
  const toggle = async () => {
    if (busy) return;
    const before = local;
    try {
      if (state === 'none') {
        setLocal('following');
        const result = await follow.mutateAsync(userId);
        if (result?.status === 'requested') setLocal('requested');
      } else {
        setLocal('none');
        await unfollow.mutateAsync(userId);
      }
    } catch {
      setLocal(before);
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={state !== 'none'}
      aria-label={`${followLabel(state)} ${name}`}
      className={`${variant === 'card' ? 'mt-2 w-full px-2' : 'shrink-0 px-3'} flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all disabled:opacity-60 ${state === 'none' ? 'bg-primary-ink text-white hover:bg-primary-hover' : 'bg-brand-text/8 text-brand-text/70 hover:bg-brand-text/12'}`}
    >
      {state === 'following' ? <Check className="h-3.5 w-3.5" aria-hidden /> : state === 'requested' ? <Clock className="h-3.5 w-3.5" aria-hidden /> : <UserPlus className="h-3.5 w-3.5" aria-hidden />}
      {followLabel(state)}
    </button>
  );
}

/**
 * Responsive suggestions grid with no nested horizontal scroll region.
 */
const PeopleYouMayKnowStrip: React.FC<PeopleYouMayKnowStripProps> = ({ offset = 0 }) => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: suggestions } = useFriendSuggestions(authUser?.id, 20);
  const hideSuggestion = useHideSuggestion();

  const { hasSent } = useSentRequests();
  const pool = suggestions ?? [];
  const { data: relMap } = useBatchRelationships(
    authUser?.id ?? '',
    pool.map((u) => u.user_id),
  );
  // Someone already followed or messaged is not a suggestion: it crowds out
  // someone actionable. Nothing is filtered until the relationships resolve.
  const eligible = pool.filter((u) => {
    // Already messaged: gone, and the next candidate takes the slot.
    if (hasSent(u.user_id)) return false;
    return !relMap?.get(u.user_id)?.following;
  });
  const visible = eligible.slice(offset, offset + 4);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl border border-brand-divider bg-brand-card p-4 shadow-xs">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-text/60" />
          <h2 className="text-sm font-semibold leading-5 text-brand-text">People you might be interested in</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-4">
        {visible.map((user) => {
          const name = user.display_name || user.username || 'Someone';
          return (
            <div
              key={user.user_id}
              className="relative min-w-0 overflow-hidden rounded-xl border border-brand-divider bg-brand-card"
            >
              {/* Dismiss */}
              <button
                aria-label={`Remove suggestion for ${name}`}
                onClick={() => hideSuggestion.mutate({ candidateUserId: user.user_id })}
                className="absolute right-1 top-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-brand-divider bg-brand-card text-brand-text transition-colors hover:bg-brand-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Portrait */}
              <button
                onClick={() => router.push(`/u/${user.username || user.user_id}`)}
                aria-label={`View ${name}'s profile`}
                className="block aspect-square w-full"
              >
                {user.avatar_media_id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/v1/media/${user.avatar_media_id}/serve`}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center bg-brand-secondary text-3xl font-semibold text-brand-text"
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {/* Name + mutuals + CTA */}
              <div className="p-2.5">
                <p className="truncate text-[13px] font-bold text-brand-text">{name}</p>
                <p className="h-4 truncate text-xs text-brand-text/45">
                  {suggestionMetaLine(user, `@${user.username ?? ''}`)}
                </p>
                <SuggestionFollowButton userId={user.user_id} name={name} following={!!relMap?.get(user.user_id)?.following} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PeopleYouMayKnowStrip;
