'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import { useAuthUser } from '@/store/auth';
import { useFriendSuggestions, useSendFriendRequest } from '@/hooks/useConnections';
import type { SuggestionUser } from '@/hooks/useConnections';
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

function isCelebOrBrand(user: SuggestionUser): boolean {
  // Celebrity/brand/business accounts come from trending bucket or have specific reason codes
  return user.source_bucket === 'trending' || user.source_bucket === 'celebrity' ||
    (user.reason_codes ?? []).some(r => r === 'POPULAR' || r === 'CELEBRITY' || r === 'BRAND');
}

const RightPanel: React.FC<RightPanelProps> = ({ onContactClick }) => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: suggestions, isLoading } = useFriendSuggestions(authUser?.id, 6);

  const sendRequest = useSendFriendRequest();
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

  const visibleSuggestions = suggestions ?? [];

  return (
    <div className="space-y-8 sticky top-28 h-fit">
      {/* Who to Follow / People you may know */}
      {(isLoading || visibleSuggestions.length > 0) && (
        <div className="bg-brand-card border border-brand-divider rounded-3xl p-6 shadow-sm">
          <h5 className="text-[10px] font-black tracking-widest uppercase text-brand-text/60 mb-6">Who to follow</h5>

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-brand-secondary" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 rounded bg-brand-secondary" />
                    <div className="h-2 w-16 rounded bg-brand-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {visibleSuggestions.map((user) => {
                  const isSent = sentIds.has(user.user_id);
                  const hasAvatar = !!user.avatar_media_id;
                  const avatarSrc = hasAvatar ? `/v1/media/${user.avatar_media_id}/serve` : null;
                  const isCeleb = isCelebOrBrand(user);
                  const actionLabel = isSent ? 'Sent' : isCeleb ? 'Follow' : 'Add Friend';

                  return (
                    <motion.div
                      key={user.user_id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="flex items-center justify-between group"
                    >
                      <button
                        onClick={() => router.push(`/u/${user.username || user.user_id}`)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        {/* Avatar: image or initial letter with random color */}
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-divider flex-shrink-0">
                          {avatarSrc ? (
                            <img src={avatarSrc} alt={user.display_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center text-white text-sm font-black ${getInitialColor(user.user_id)}`}>
                              {getInitial(user.display_name)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h6 className="text-xs font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">{user.display_name}</h6>
                          {user.username && (
                            <p className="text-[10px] text-brand-text/40 uppercase tracking-widest truncate">@{user.username}</p>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleAction(user)}
                        disabled={isSent}
                        className={`text-[10px] font-black tracking-widest uppercase transition-colors flex-shrink-0 ml-3 whitespace-nowrap ${
                          isSent
                            ? 'text-brand-text/30'
                            : 'text-brand-accent hover:text-brand-text'
                        }`}
                      >
                        {actionLabel}
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          <button
            onClick={() => router.push('/circle')}
            className="w-full mt-8 py-3 bg-brand-bg text-brand-text text-[10px] font-black tracking-widest uppercase rounded-xl hover:bg-brand-accent hover:text-brand-bg transition-all"
          >
            Show More
          </button>
        </div>
      )}

      {/* Trending Topics */}
      <div className="bg-brand-card border border-brand-divider rounded-3xl p-6 shadow-sm">
        <h5 className="text-[10px] font-black tracking-widest uppercase text-brand-text/60 mb-6">Trending Topics</h5>
        <div className="space-y-4">
          {[
            { tag: '#Minimalism', posts: '12.4k' },
            { tag: '#DigitalArt', posts: '8.2k' },
            { tag: '#TechTrends', posts: '5.1k' },
          ].map((trend) => (
            <div key={trend.tag} className="group cursor-pointer">
              <h6 className="text-xs font-bold text-brand-text group-hover:text-brand-accent transition-colors">{trend.tag}</h6>
              <p className="text-[10px] text-brand-text/40 uppercase tracking-widest">{trend.posts} posts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 text-[10px] text-brand-text/40 uppercase tracking-[0.2em] space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href="#" className="hover:text-brand-accent transition-colors">About</a>
          <a href="#" className="hover:text-brand-accent transition-colors">Privacy</a>
          <a href="#" className="hover:text-brand-accent transition-colors">Terms</a>
        </div>
        <p>&copy; 2026 atpost</p>
      </footer>
    </div>
  );
};

export default RightPanel;
