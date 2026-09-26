"use client";

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  subscribeToPostRoom, unsubscribeFromPostRoom, subscribeToPostUpdates,
  subscribeToCommentChanges, subscribeToHubConnected, refreshPostRooms,
} from '@/services/messageService';
import { applyPostCommentCount, refreshCommentSurfaces } from '@/lib/commentCache';
import { bindPostThread } from '@/lib/postThreadLive';

/** Shared by reel and ordinary post threads; a silent room refusal never disables polling. */
export function usePostRoom(postId: string | undefined, refreshMs = 30000) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!postId) return;
    const refresh = () => refreshCommentSurfaces(qc, postId);
    const dispose = bindPostThread(postId, {
      subscribe: subscribeToPostRoom, unsubscribe: unsubscribeFromPostRoom,
      onConnected: subscribeToHubConnected, onChange: subscribeToCommentChanges,
      onUpdate: subscribeToPostUpdates,
      setCount: count => applyPostCommentCount(qc, postId, count),
      refreshThread: () => {
        void qc.invalidateQueries({ queryKey: ['comments', postId] });
        void qc.invalidateQueries({ queryKey: ['comments-around', postId] });
      },
      refresh,
    });
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshPostRooms();
      refresh();
    }, refreshMs);
    return () => { clearInterval(timer); dispose(); };
  }, [postId, refreshMs, qc]);
}
