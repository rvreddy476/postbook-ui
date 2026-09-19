'use client';

import React, { useRef } from 'react';
import { useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import { useUserProfile } from '@/hooks/useEditProfile';
import type { CommentItem } from '@/types/profile';

interface CommentPreviewProps {
  postId: string;
  count: number;
  /** Opens the full comment section. */
  onOpen: () => void;
}

/**
 * One comment under a post, so a feed shows that people are talking.
 *
 * The feed does not return comment text, so this is one extra request per
 * post — which is why it is fenced three ways: it runs only for posts that
 * HAVE comments (the count is already in the feed), only once the card is
 * near the viewport, and only once per post, cached. It asks for a single
 * comment, not the fifty the full section loads.
 *
 * A comment author's name needs its own profile lookup; those are cached per
 * person, so the same commenter across several posts costs one request.
 */
export default function CommentPreview({ postId, count, onOpen }: CommentPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: '300px 0px' });

  const { data: comment } = useQuery({
    queryKey: ['comment-preview', postId],
    queryFn: async () => {
      const res = await api.get<{ data: CommentItem[] | { items?: CommentItem[] } }>(
        `/v1/posts/${postId}/comments`,
        { params: { limit: '1' } },
      );
      const data = res.data.data;
      const list = Array.isArray(data) ? data : data?.items ?? [];
      return list[0] ?? null;
    },
    enabled: near && count > 0,
    staleTime: 60_000,
  });

  const { data: author } = useUserProfile(comment?.author_id);
  const body = (comment?.body || comment?.text || '').trim();
  const authorName = author?.display_name || author?.username || '';

  return (
    <div ref={ref} className="px-4 pb-3 pt-1">
      {body && authorName && (
        <p className="line-clamp-2 text-sm text-brand-text">
          <span className="font-semibold">{authorName}</span>{' '}
          <span className="text-brand-text/80">{body}</span>
        </p>
      )}
      <button
        onClick={onOpen}
        className="mt-1 text-xs font-medium text-muted-foreground transition-colors hover:text-brand-text"
      >
        {count === 1 ? 'View 1 comment' : `View all ${count} comments`}
      </button>
    </div>
  );
}
