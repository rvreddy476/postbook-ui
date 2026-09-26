"use client";

import Link from 'next/link';
import { ArrowUpRight, Clapperboard, Plus, Play } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/LetterAvatar';
import { useFollowUser, useUnfollowUser } from '@/hooks/useEditProfile';
import { useGlobalToast } from '@/contexts/ToastContext';
import type { Relationship } from '@/types/profile';
import type { ReelItem } from '../model';

/** A real reel proves that this is a creator; generic people suggestions do not. */
export function otherReelCreators(reels: ReelItem[], authorId: string, viewerId: string) {
  const seen = new Set([authorId, viewerId]);
  return reels.filter(reel => {
    if (!reel.authorId || seen.has(reel.authorId)) return false;
    seen.add(reel.authorId);
    return true;
  }).slice(0, 4);
}

export function ReelDiscoveryPanel({ reels, active, viewerId, relationships, onOpenReel, canLoadMore, loadingMore, onLoadMore }: {
  reels: ReelItem[]; active: ReelItem; viewerId: string; relationships?: Map<string, Relationship>;
  onOpenReel: (id: string) => void; canLoadMore: boolean; loadingMore: boolean; onLoadMore: () => void;
}) {
  const creators = otherReelCreators(reels, active.authorId, viewerId);
  return <aside className="reel-discovery" aria-label="More creators">
    <section className="reel-discovery-card">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">More creators</h2><Link href="/search" aria-label="Explore creators and posts" className="text-primary-ink"><ArrowUpRight size={18}/></Link></div>
      {creators.length ? <div className="reel-creator-list">{creators.map(reel => <CreatorRow key={reel.authorId} reel={reel} relationship={relationships?.get(reel.authorId)} onOpen={() => onOpenReel(reel.id)}/>)}</div>
        : <p className="py-5 text-sm text-text-muted">No other creators in this selection yet.</p>}
      {canLoadMore ? <button type="button" className="reel-text-action" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? 'Loading…' : 'Discover more reels'}</button> : null}
    </section>
    <section className="reel-create-card">
      <span className="reel-section-icon"><Clapperboard size={22}/></span>
      <h2 className="text-lg font-bold">Your next reel</h2>
      <p className="text-sm text-text-muted">Record a moment. Share your perspective.</p>
      <Link href="/reels/create" className="reel-profile-link"><Plus size={18}/> Create a reel <ArrowUpRight size={16}/></Link>
    </section>
  </aside>;
}

function CreatorRow({reel, relationship, onOpen}: {reel: ReelItem; relationship?: Relationship; onOpen: () => void}) {
  const follow = useFollowUser(); const unfollow = useUnfollowUser();
  const qc = useQueryClient(); const toast = useGlobalToast();
  const pending = follow.isPending || unfollow.isPending;
  const toggle = async () => {
    if (!reel.authorUsername || relationship?.following === undefined || pending) return;
    try {
      await (relationship.following ? unfollow : follow).mutateAsync(reel.authorUsername);
      void qc.invalidateQueries({queryKey:['relationships','batch']});
    } catch { toast({type:'error',title:'Could not update follow. Try again.'}); }
  };
  return <div className="reel-discovery-row">
    <button type="button" onClick={onOpen} className="reel-discovery-person" aria-label={`Watch a reel by ${reel.authorName}`}>
      <span className="relative shrink-0"><Avatar src={reel.authorAvatarUrl} name={reel.authorName} seed={reel.authorId}/><Play size={11} className="reel-avatar-play"/></span>
      <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{reel.authorName}</span><span className="block truncate text-[11px] text-text-muted">{reel.authorUsername ? `@${reel.authorUsername}` : 'Watch reel'}</span></span>
    </button>
    {relationship?.following !== undefined && reel.authorUsername ? <button type="button" onClick={toggle} disabled={pending} className="reel-follow-small">{relationship.following ? 'Following' : 'Follow'}</button> : null}
  </div>;
}
