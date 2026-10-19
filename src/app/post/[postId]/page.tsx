'use client';

import React, { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PostDetailStage } from '@/features/post-stage/components/PostDetailStage';

/*
  One post on the full-screen stage (features/post-stage): the same frame,
  caption and rail as /feed, a back button, and an "Add comment…" bar that
  opens the comments sheet.
*/
function PostDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const postId = params.postId as string;
  const focusCommentId = searchParams.get('focusComment') || undefined;
  return <PostDetailStage postId={postId} focusCommentId={focusCommentId} />;
}

export default function PostDetailPage() {
  return (
    <Suspense fallback={null}>
      <PostDetailContent />
    </Suspense>
  );
}
