'use client';

import VideoPlayer from '@/components/VideoPlayer';
import { EMBED_UNAVAILABLE_TEXT, embeddableVideoId } from '@/lib/postEmbed';
import type { PostDetail } from '@/types/profile';

/*
  What /post/<id>/embed draws, split from the page so the refusal is
  testable without a router. A bare player and one link back to the full
  post: no app chrome, no comments.

  It plays only a public video post (embeddableVideoId). Anything else —
  private, followers-only, unlisted, members-only, age-restricted, not found,
  not a video — gets the same neutral line, so the frame never confirms that
  a post it will not show exists. A reel starts muted, as reels always do.
*/

export interface PostEmbedViewProps {
  post: PostDetail | null | undefined;
  loading: boolean;
  failed: boolean;
}

export default function PostEmbedView({ post, loading, failed }: PostEmbedViewProps) {
  if (loading) {
    return <div className="fixed inset-0 bg-canvas" aria-busy="true" />;
  }

  const mediaId = failed ? null : embeddableVideoId(post);
  if (!post || !mediaId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-canvas p-4 text-center text-[13px] text-brand-text/60">
        <p>{EMBED_UNAVAILABLE_TEXT}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-canvas">
      <VideoPlayer mediaId={mediaId} className="min-h-0 w-full flex-1" initialMuted={post.content_type === 'short'} />
      <a
        href={`/post/${encodeURIComponent(post.id)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate border-t border-brand-divider px-3 py-2 text-[12px] font-semibold text-brand-text hover:text-primary-ink"
      >
        {post.title?.trim() || 'Open the full post'}
      </a>
    </div>
  );
}
