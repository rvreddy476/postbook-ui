'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Users, X } from 'lucide-react';

import { useAuthUser } from '@/store/auth';
import {
  useFriendSuggestions,
  useHideSuggestion,
  useBatchRelationships,
  type SuggestionUser,
} from '@/hooks/useConnections';
import { FriendRequestButton } from '@/components/connections/FriendRequestButton';

const AVATAR_GRADIENTS = [
  'from-rose-400 to-orange-400',
  'from-blue-400 to-cyan-400',
  'from-emerald-400 to-teal-400',
  'from-purple-400 to-pink-400',
  'from-amber-400 to-red-400',
  'from-indigo-400 to-blue-400',
];

function gradientFor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

interface PeopleYouMayKnowStripProps {
  /** Which slice of the suggestion list this strip instance shows —
   *  lets a second strip deeper in the feed show different people. */
  offset?: number;
}

/**
 * Horizontal "People you may know" card strip rendered inline in the
 * main feed (FB-style), replacing the old right-panel widget.
 */
const PeopleYouMayKnowStrip: React.FC<PeopleYouMayKnowStripProps> = ({ offset = 0 }) => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: suggestions } = useFriendSuggestions(authUser?.id, 20);
  const hideSuggestion = useHideSuggestion();

  const pool = suggestions ?? [];
  const { data: relMap } = useBatchRelationships(
    authUser?.id ?? '',
    pool.map((u) => u.user_id),
  );
  // Someone already asked is not a suggestion: leaving them here invites
  // the same request twice and crowds out someone actionable. Nothing is
  // filtered until the relationships resolve.
  const eligible = pool.filter((u) => {
    const rel = relMap?.get(u.user_id);
    if (!rel) return true;
    return rel.connection_status !== 'pending_sent' && !rel.is_connection;
  });
  const visible = eligible.slice(offset, offset + 10);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl border border-brand-divider bg-brand-card p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-text/60" />
          <h5 className="text-[13px] font-bold text-brand-text">People you may know</h5>
        </div>
        <button
          onClick={() => router.push('/connections')}
          className="text-xs font-bold text-brand-highlight transition-colors hover:text-brand-text"
        >
          See all
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {visible.map((user) => {
          const name = user.display_name || user.username || 'Someone';
          return (
            <div
              key={user.user_id}
              className="relative w-[150px] shrink-0 overflow-hidden rounded-xl border border-brand-divider bg-brand-card shadow-xs"
            >
              {/* Dismiss */}
              <button
                aria-label="Remove suggestion"
                onClick={() => hideSuggestion.mutate({ candidateUserId: user.user_id })}
                className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Portrait */}
              <button
                onClick={() => router.push(`/u/${user.username || user.user_id}`)}
                className="block h-[150px] w-full"
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
                    className={`flex h-full w-full items-center justify-center bg-linear-to-br ${gradientFor(user.user_id)} text-4xl font-black text-white`}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {/* Name + mutuals + CTA */}
              <div className="p-2.5">
                <p className="truncate text-[13px] font-bold text-brand-text">{name}</p>
                <p className="h-4 truncate text-[11px] text-brand-text/45">
                  {user.mutual_friend_count
                    ? `${user.mutual_friend_count} mutual friend${user.mutual_friend_count === 1 ? '' : 's'}`
                    : `@${user.username ?? ''}`}
                </p>
                <FriendRequestButton
                allowSend={false}
                  targetUserId={user.user_id}
                  targetUsername={user.username}
                  relationship={relMap?.get(user.user_id)}
                  addLabel="Connect"
                  showIncomingActions={false}
                  allowCancel={false}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-ink px-2 py-2 text-[11px] font-bold text-white transition-all hover:bg-primary-hover disabled:opacity-60"
                  sentClassName="bg-brand-text/8 text-brand-text/50 hover:opacity-100"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PeopleYouMayKnowStrip;
