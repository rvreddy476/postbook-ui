'use client';

import React, { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { usePostDetail } from '@/hooks/useFeedPosts';
import { usePostRoom } from '@/hooks/usePostRoom';
import PostCard from '@/components/PostCard';
import CommentSection from '@/components/CommentSection';
import { ArrowLeft } from 'lucide-react';

function PostDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params.postId as string;
  const focusCommentId = searchParams.get('focusComment') || undefined;

  const { data: post, isLoading, isError } = usePostDetail(postId);

  // Subscribe to real-time per-post updates via WebSocket
  usePostRoom(postId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-black text-brand-text/30 uppercase tracking-widest italic">Post not found</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-brand-card rounded-2xl font-black text-[10px] uppercase tracking-widest text-brand-highlight hover:text-blue-600 hover:shadow-lg transition-all border border-brand-divider"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg font-sans selection:bg-rose-100 selection:text-rose-900">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-brand-card/80 backdrop-blur-xl border-b border-white/40">
        <div className="max-w-[640px] mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-brand-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-brand-highlight" />
          </button>
          <h1 className="text-sm font-black uppercase tracking-widest text-brand-text italic">Post</h1>
        </div>
      </div>

      {/* Post content */}
      <div className="max-w-[640px] mx-auto px-4 sm:px-0 py-8 space-y-0">
        <PostCard post={post} />

        {/* Always-expanded comment section for detail page */}
        <div className="glass-panel rounded-b-[3rem] border border-t-0 border-white/80 overflow-hidden -mt-1">
          <CommentSection
            postId={post.id}
            commentsCount={post.counts?.comments ?? 0}
            alwaysExpanded
            focusCommentId={focusCommentId}
          />
        </div>
      </div>
    </div>
  );
}

export default function PostDetailPage() {
  return (
    <Suspense fallback={null}>
      <PostDetailContent />
    </Suspense>
  )
}
