'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '../types';
import { useAuthUser } from '@/store/auth';
import { useFriendSuggestions, useSendFriendRequest } from '@/hooks/useConnections';
import type { SuggestionUser } from '@/hooks/useConnections';

interface RightPanelProps {
  onContactClick: (contact: User) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ onContactClick }) => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: suggestions, isLoading: suggestionsLoading } = useFriendSuggestions(authUser?.id, 5);
  const sendRequest = useSendFriendRequest();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const trending = [
    { tag: '#PostBoekLive', posts: '2.4M', category: 'Technology', color: 'text-indigo-600' },
    { tag: '#NebulaForge', posts: '920K', category: 'AI Tools', color: 'text-violet-600' },
    { tag: '#PrismaticDesign', posts: '4.1M', category: 'Arts', color: 'text-rose-500' },
  ];

  const getAvatar = (u: SuggestionUser) =>
    u.avatar_media_id
      ? `/v1/media/${u.avatar_media_id}/serve`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.user_id}`;

  const handleAddFriend = async (user: SuggestionUser) => {
    if (!user.username || sentIds.has(user.user_id)) return;
    try {
      await sendRequest.mutateAsync(user.username);
      setSentIds(prev => new Set(prev).add(user.user_id));
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* People You May Know */}
      {(suggestionsLoading || (suggestions && suggestions.length > 0)) && (
        <section className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-50">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 italic">People You May Know</h3>

          {suggestionsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-24 h-3 rounded bg-slate-100 animate-pulse" />
                    <div className="w-16 h-2 rounded bg-slate-50 animate-pulse" />
                  </div>
                  <div className="w-16 h-7 rounded-lg bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions?.map(user => {
                const isSent = sentIds.has(user.user_id);
                return (
                  <div key={user.user_id} className="flex items-center gap-3 -mx-1 px-1 py-1.5 rounded-xl hover:bg-slate-50/50 transition-colors">
                    <button
                      onClick={() => router.push(`/u/${user.username || user.user_id}`)}
                      className="w-10 h-10 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0 shadow-sm"
                    >
                      <img src={getAvatar(user)} alt={user.display_name} className="w-full h-full object-cover" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => router.push(`/u/${user.username || user.user_id}`)}
                        className="text-left w-full"
                      >
                        <p className="text-[12px] font-black text-slate-900 truncate leading-tight hover:text-violet-600 transition-colors">
                          {user.display_name}
                        </p>
                        {user.username && (
                          <p className="text-[10px] text-slate-400 font-medium truncate">@{user.username}</p>
                        )}
                      </button>
                    </div>
                    <button
                      onClick={() => handleAddFriend(user)}
                      disabled={isSent || sendRequest.isPending}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                        isSent
                          ? 'bg-emerald-50 text-emerald-600 cursor-default'
                          : 'orchid-gradient text-white shadow-sm hover:opacity-90 active:scale-95'
                      }`}
                    >
                      {isSent ? 'Sent' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Sponsored Space */}
      <section className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-50">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sponsored</h3>
          <button className="text-[9px] font-black text-indigo-600 hover:underline uppercase tracking-widest">Manifest Ad</button>
        </div>
        <div className="space-y-5">
          <div className="group cursor-pointer">
            <div className="aspect-[16/9] rounded-2xl overflow-hidden mb-3 shadow-md border border-white ring-1 ring-slate-100">
              <img src="https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=600" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="Ad" />
            </div>
            <h4 className="text-sm font-black text-slate-950 leading-tight">Nebula Pro Architecture</h4>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1">unite.nebula.ai</p>
          </div>
        </div>
      </section>

      {/* Birthdays / Events */}
      <section className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-50">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Celebrations</h3>
        <div className="flex items-start gap-4">
          <div className="text-2xl bg-indigo-50 p-3 rounded-2xl shadow-inner">🎂</div>
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-black text-slate-950">Sarah Wilson</span> and <span className="font-black text-slate-950">2 others</span> are manifestating birthdays today.
          </p>
        </div>
      </section>

      {/* Network Pulse (Trending) */}
      <section className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-50">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 italic">Network Pulse</h3>
        <div className="space-y-6">
          {trending.map((item) => (
            <div key={item.tag} className="hover:bg-slate-50 -mx-2 p-2 rounded-2xl transition-all cursor-pointer group">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{item.category}</p>
              <h4 className={`font-black text-base italic tracking-tight ${item.color} group-hover:scale-105 transition-transform origin-left`}>
                {item.tag}
              </h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.posts} manifests</p>
            </div>
          ))}
          <button className="w-full py-4 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all uppercase tracking-widest text-center mt-2 border border-dashed border-indigo-100">
            Expand View
          </button>
        </div>
      </section>

      {/* Footer Links */}
      <div className="px-6 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-300 font-black uppercase tracking-widest">
        <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
        <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
        <a href="#" className="hover:text-indigo-600 transition-colors">Ads</a>
        <span>PostBoek.com © 2025</span>
      </div>
    </div>
  );
};

export default RightPanel;
