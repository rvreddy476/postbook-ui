"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircleOff } from "lucide-react";

import { usePostDetail } from "@/hooks/useFeedPosts";
import { usePostRoom } from "@/hooks/usePostRoom";
import { ShareSheet } from "@/features/reels/components/ShareSheet";
import { reelPermalink } from "@/features/reels/model";
import { PostStage } from "@/features/post-stage/components/PostStage";
import { StagePortal } from "@/features/post-stage/components/StagePortal";
import { StageCommentsSheet } from "@/features/post-stage/components/StageCommentsSheet";
import { useAuthorFollow } from "@/features/post-stage/hooks/useAuthorFollow";
import { usePostCountUpdates } from "@/features/post-stage/hooks/usePostCountUpdates";
import "@/features/post-stage/post-stage.css";

/*
  /post/[postId]: the same stage as the feed, for one post. A back button
  at the top-left, and an "Add comment…" bar pinned at the bottom that opens
  the comments sheet — or says "Comments are turned off" when the author
  turned them off. ?focusComment= opens the sheet on that comment.
*/
export function PostDetailStage({ postId, focusCommentId }: { postId: string; focusCommentId?: string }) {
  const router = useRouter();
  const { data: post, isLoading, isError } = usePostDetail(postId);
  usePostRoom(postId);
  usePostCountUpdates();
  const authorId = post?.author?.id || post?.author_id || "";
  const { viewerId, followingOf, follow, pendingId } = useAuthorFollow(authorId ? [authorId] : []);
  const [commentsOpen, setCommentsOpen] = useState(Boolean(focusCommentId));
  const [shareOpen, setShareOpen] = useState(false);

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/feed");
  };

  const commentsOff = post?.no_comments === true;

  return (
    <div className="ps-feed is-detail" data-comments-open={commentsOpen && !commentsOff ? "true" : undefined}>
      <button type="button" className="ps-back" aria-label="Back" onClick={back}>
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
      <div className="ps-scroller is-single">
        {isLoading ? (
          <div className="ps-page ps-state" role="status" aria-label="Loading post">
            <Loader2 size={28} className="motion-safe:animate-spin" aria-hidden="true" />
          </div>
        ) : isError || !post ? (
          <div className="ps-page ps-state" role="alert">
            <p>Post not found</p>
            <button type="button" className="ps-state__action" onClick={back}>Go back</button>
          </div>
        ) : (
          <section className="ps-page" aria-label="Post">
            <h1 className="sr-only">Post</h1>
            <PostStage
              row={post}
              active
              viewerId={viewerId}
              following={followingOf(authorId)}
              followPending={pendingId === authorId}
              onFollow={(id, name) => void follow(id, name)}
              onComments={() => setCommentsOpen(true)}
              onShare={() => setShareOpen(true)}
            />
          </section>
        )}
      </div>
      {post ? (
        <div className="ps-commentbar">
          {commentsOff ? (
            <p className="ps-commentbar__off">
              <MessageCircleOff size={16} aria-hidden="true" />
              Comments are turned off
            </p>
          ) : (
            <button type="button" className="ps-commentbar__field" onClick={() => setCommentsOpen(true)}>
              Add comment…
            </button>
          )}
        </div>
      ) : null}
      {post ? (
        <>
          <StageCommentsSheet
            open={commentsOpen && !commentsOff}
            postId={post.id}
            authorId={post.author_id}
            count={post.counts?.comments ?? 0}
            focusCommentId={focusCommentId}
            onClose={() => setCommentsOpen(false)}
            detail
          />
          <StagePortal>
            <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} url={reelPermalink(post.id)} postId={post.id} />
          </StagePortal>
        </>
      ) : null}
    </div>
  );
}
