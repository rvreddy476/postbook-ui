'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { Sparkles, Users, ChevronRight } from 'lucide-react';

import { useAuthUser } from '@/store/auth';
import { useFriendSuggestions, useHubSuggestions, useSendFriendRequest, useHideSuggestion } from '@/hooks/useConnections';
import FriendCard from '@/components/FriendCard';
import type { SuggestionUser } from '@/hooks/useConnections';
import { useTrending } from '@/hooks/useSearch';
import { User } from '../types';

interface RightPanelProps {
  onContactClick: (contact: User) => void;
}

const AVATAR_COLORS = [
  'bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-orange-500',
];

function getInitialColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitial(name: string): string {
  return (name?.charAt(0) || '?').toUpperCase();
}

// isCelebOrBrand was a heuristic that decided between "Follow" and "Add"
// based on source_bucket / reason_codes. Removed for relationship-separation
// spec §6: user suggestions are friends-only ("Add Friend"), hub suggestions
// are follows-only ("Follow"), and the two never share a widget.

const RightPanel: React.FC<RightPanelProps> = ({ onContactClick }) => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: suggestions, isLoading } = useFriendSuggestions(authUser?.id, 6);
  const { data: hubSuggestions } = useHubSuggestions(authUser?.id, 6);
  const { data: trendingData, isLoading: trendingLoading } = useTrending();

  const sendRequest = useSendFriendRequest();
  const hideSuggestion = useHideSuggestion();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const handleAction = async (user: SuggestionUser) => {
    if (sentIds.has(user.user_id)) return;
    try {
      await sendRequest.mutateAsync(user.username || user.user_id);
      setSentIds((prev) => new Set(prev).add(user.user_id));
    } catch {
      // Handled by mutation
    }
  };

  const handleRemove = (user: SuggestionUser) => {
    hideSuggestion.mutate({ candidateUserId: user.user_id });
  };

  const visibleSuggestions = suggestions ?? [];

  return (
    <div className="space-y-8 sticky top-28 h-fit">
      {/* Who to Follow / People you may know */}
      {(isLoading || visibleSuggestions.length > 0) && (
        <div className="rounded-3xl bg-brand-card border border-brand-divider p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary border border-brand-divider shadow-sm">
                <Users className="h-3.5 w-3.5 text-brand-text" />
              </div>
              <h5 className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-text">
                People You May Know
              </h5>
            </div>
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-brand-card border border-brand-divider p-4 shadow-sm">
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="h-14 w-14 rounded-full bg-brand-secondary" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 rounded bg-brand-secondary" />
                      <div className="h-2 w-32 rounded bg-brand-secondary" />
                      <div className="h-7 w-full rounded-full bg-brand-secondary" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {visibleSuggestions.map((user) => {
                  const isSent = sentIds.has(user.user_id);
                  // Spec §6.2: every row in People You May Know shows Add Friend.
                  // Follow lives in the Suggested Hubs widget below.
                  const primaryLabel = isSent ? 'Sent' : 'Add Friend';
                  return (
                    <FriendCard
                      key={user.user_id}
                      userId={user.user_id}
                      displayName={user.display_name}
                      username={user.username}
                      avatarMediaId={user.avatar_media_id}
                      mutualFriendCount={user.mutual_friend_count}
                      mutualFriendIds={user.mutual_friend_ids}
                      reasonCodes={user.reason_codes}
                      primaryLabel={primaryLabel}
                      primaryDisabled={isSent}
                      primaryLoading={sendRequest.isPending}
                      onPrimary={() => handleAction(user)}
                      secondaryLabel="Remove"
                      onSecondary={() => handleRemove(user)}
                      secondaryDisabled={hideSuggestion.isPending}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          <button
            onClick={() => router.push('/circle')}
            className="mt-3 flex w-full items-center justify-between rounded-full bg-brand-secondary border border-brand-divider px-4 py-3 shadow-sm transition hover:bg-brand-secondary/80"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-text text-brand-bg">
                <Users className="h-3.5 w-3.5" />
              </div>
              <span className="text-[12px] font-semibold text-brand-text">Show More</span>
            </div>
            <ChevronRight className="h-4 w-4 text-brand-text/60" />
          </button>
        </div>
      )}

      {/* Suggested Hubs (spec §6.3) — entirely separate from People You May
          Know above. Only renders when the hub-candidate generator returns
          at least one approved hub; backend currently returns empty so this
          stays hidden by default. */}
      {(hubSuggestions ?? []).length > 0 && (
        <div className="rounded-3xl bg-brand-card border border-brand-divider p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary border border-brand-divider shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-brand-text" />
              </div>
              <h5 className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-text">
                Suggested Hubs
              </h5>
            </div>
          </div>
          <div className="space-y-3">
            {(hubSuggestions ?? []).map((hub) => (
              <FriendCard
                key={hub.user_id}
                userId={hub.user_id}
                displayName={hub.display_name}
                username={hub.username}
                avatarMediaId={hub.avatar_media_id}
                mutualFriendCount={0}
                mutualFriendIds={[]}
                reasonCodes={hub.reason_codes}
                primaryLabel="Follow"
                primaryDisabled={false}
                primaryLoading={false}
                onPrimary={() => router.push(`/page/${hub.username || hub.user_id}`)}
                secondaryLabel="Remove"
                onSecondary={() => hideSuggestion.mutate({ candidateUserId: hub.user_id, type: 'follow' })}
                secondaryDisabled={hideSuggestion.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trending Topics */}
      {(trendingLoading || (trendingData?.trending ?? []).length > 0) && (
        <div className="bg-brand-card border border-brand-divider rounded-3xl p-6 shadow-sm">
          <h5 className="text-[10px] font-black tracking-widest uppercase text-brand-text/60 mb-6">Trending Topics</h5>
          {trendingLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-brand-secondary" />
                  <div className="h-2 w-16 rounded bg-brand-secondary" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(trendingData?.trending ?? []).slice(0, 5).map((trend) => (
                <button
                  key={trend.hashtag}
                  onClick={() => router.push(`/hashtag/${trend.hashtag}`)}
                  className="group cursor-pointer block text-left w-full"
                >
                  <h6 className="text-xs font-bold text-brand-text group-hover:text-brand-accent transition-colors">#{trend.hashtag}</h6>
                  <p className="text-[10px] text-brand-text/40 uppercase tracking-widest">
                    {trend.score >= 1000 ? `${(trend.score / 1000).toFixed(1)}k` : Math.round(trend.score)} posts
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="px-6 text-[10px] text-brand-text/40 uppercase tracking-[0.2em] space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href="#" className="hover:text-brand-accent transition-colors">About</a>
          <a href="#" className="hover:text-brand-accent transition-colors">Privacy</a>
          <a href="#" className="hover:text-brand-accent transition-colors">Terms</a>
        </div>
        <p>&copy; 2026 VChat</p>
      </footer>
    </div>
  );
};

export default RightPanel;
