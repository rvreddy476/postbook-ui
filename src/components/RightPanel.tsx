'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, MessageCircle, Sparkles, UserPlus, X } from 'lucide-react';

import { useAuthUser } from '@/store/auth';
import { useFriendSuggestions, useHideSuggestion, useSendFriendRequest } from '@/hooks/useConnections';
import type { SuggestionUser } from '@/hooks/useConnections';
import { User } from '../types';

interface RightPanelProps {
  onContactClick: (contact: User) => void;
}

function getAccentFromId(userId: string): string {
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const styles = [
    'from-blue-500 to-indigo-500',
    'from-emerald-500 to-teal-500',
    'from-rose-500 to-orange-500',
    'from-[#D8103F]/50 to-fuchsia-500',
  ];
  return styles[hash % styles.length];
}

const RightPanel: React.FC<RightPanelProps> = ({ onContactClick }) => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: suggestions, isLoading: suggestionsLoading } = useFriendSuggestions(authUser?.id, 6);

  const sendRequest = useSendFriendRequest();
  const hideSuggestion = useHideSuggestion();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const getAvatar = (user: SuggestionUser) =>
    user.avatar_media_id
      ? `/v1/media/${user.avatar_media_id}/serve`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.user_id}`;

  const handleAddFriend = async (user: SuggestionUser) => {
    if (sentIds.has(user.user_id)) return;
    try {
      await sendRequest.mutateAsync(user.username || user.user_id);
      setSentIds((prev) => new Set(prev).add(user.user_id));
    } catch {
      // Handled by mutation
    }
  };

  const handleDismiss = (userId: string) => {
    setDismissedIds((prev) => new Set(prev).add(userId));
    hideSuggestion.mutate({ candidateUserId: userId });
  };

  const openQuickChat = (user: SuggestionUser) => {
    onContactClick({
      id: user.user_id,
      name: user.display_name,
      avatar: getAvatar(user),
      isOnline: false,
    });
  };

  const visibleSuggestions = suggestions?.filter((user) => !dismissedIds.has(user.user_id)) ?? [];

  return (
    <div className="space-y-5 pb-8">
      {(suggestionsLoading || visibleSuggestions.length > 0) && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Suggestions</p>
              <h3 className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-blue-500" />
                People To Follow
              </h3>
            </div>
            <button
              onClick={() => router.push('/circle')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 transition hover:text-blue-700"
            >
              See all
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {suggestionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2.5">
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-2 w-20 animate-pulse rounded bg-slate-50" />
                  </div>
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {visibleSuggestions.map((user, index) => {
                  const isSent = sentIds.has(user.user_id);
                  return (
                    <motion.div
                      key={user.user_id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.03 } }}
                      exit={{ opacity: 0, x: 8 }}
                      className="group rounded-2xl border border-slate-100 bg-white px-3 py-3 transition hover:border-slate-200 hover:bg-slate-50/70"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => router.push(`/u/${user.username || user.user_id}`)}
                          className="relative h-11 w-11 overflow-hidden rounded-xl"
                        >
                          <img src={getAvatar(user)} alt={user.display_name} className="h-full w-full object-cover" />
                          <span className={`pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br ${getAccentFromId(user.user_id)} opacity-20`} />
                        </button>

                        <button
                          onClick={() => router.push(`/u/${user.username || user.user_id}`)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-[13px] font-semibold text-slate-900">{user.display_name}</p>
                          {user.username && (
                            <p className="truncate text-[11px] text-slate-400">@{user.username}</p>
                          )}
                          {user.explain_text && (
                            <p className="mt-1 truncate text-[10px] font-medium text-blue-500">{user.explain_text}</p>
                          )}
                        </button>

                        <button
                          onClick={() => handleDismiss(user.user_id)}
                          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition hover:bg-white hover:text-slate-500"
                          title="Dismiss"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleAddFriend(user)}
                          disabled={isSent || sendRequest.isPending}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-semibold transition ${
                            isSent
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {isSent ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                          {isSent ? 'Sent' : 'Add'}
                        </button>
                        <button
                          onClick={() => openQuickChat(user)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Message
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </section>
      )}

      <div className="px-1 text-[10px] font-medium text-slate-400">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <a href="#" className="transition hover:text-slate-600">Privacy</a>
          <a href="#" className="transition hover:text-slate-600">Terms</a>
          <a href="#" className="transition hover:text-slate-600">Ads</a>
          <span>PostBoek.com 2026</span>
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
