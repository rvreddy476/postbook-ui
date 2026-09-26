"use client";
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchReel } from '../data/reelFeedApi';
import { patchReelEverywhere } from './useReelFeed';
import { usePostRoom } from '@/hooks/usePostRoom';

/** Events are invalidation hints, not arithmetic: duplicate/out-of-order events cannot inflate counts. */
export function useReelLive(postId: string | undefined, commentsOpen: boolean) {
  const qc = useQueryClient();
  usePostRoom(postId, commentsOpen ? 15000 : 30000);
  const live = useQuery({
    queryKey: ['reels', 'live', postId],
    queryFn: ({signal}) => fetchReel(postId!, signal),
    enabled: !!postId,
    refetchInterval: commentsOpen ? 15000 : 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  useEffect(() => {
    const item = live.data;
    if (!postId || !item || item.id !== postId) return;
    patchReelEverywhere(qc, postId, {
      title: item.title, commentCount: item.commentCount, likeCount: item.likeCount,
      shareCount: item.shareCount, viewCount: item.viewCount, viewerLiked: item.viewerLiked,
      isProcessing: item.isProcessing,
      authorId: item.authorId, authorName: item.authorName,
      authorUsername: item.authorUsername, authorAvatarUrl: item.authorAvatarUrl,
    });
    // Polling repairs missed events and silently refused room subscriptions.
    if (commentsOpen) {
      void qc.invalidateQueries({queryKey:['comments',postId]});
      void qc.invalidateQueries({queryKey:['comments-around',postId]});
    }
  }, [live.data, live.dataUpdatedAt, postId, commentsOpen, qc]);
}
