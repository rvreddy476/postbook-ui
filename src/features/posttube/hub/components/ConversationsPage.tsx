"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, MessageSquareReply, MoreHorizontal, Pin, PinOff, Trash2, UserX, VolumeX } from "lucide-react";
import { useMemo, useState } from "react";

import MentionText from "@/components/comments/MentionText";
import ReplyComposer from "@/components/comments/ReplyComposer";
import { ConfirmDialog } from "@/features/posttube/components/ConfirmDialog";
import { useGlobalToast } from "@/contexts/ToastContext";
import { useBlockUser } from "@/hooks/useBlocking";
import { useMuteUser } from "@/hooks/useMuting";
import { flattenReplies, useCommentReplies, useDeleteComment } from "@/hooks/usePostComments";
import { useBatchProfiles } from "@/hooks/useProfile";
import { formatCount, mediaServeUrl, timeAgo } from "@/features/posttube/model";
import { useAuthUser } from "@/store/auth";
import type { CommentItem, UserProfile } from "@/types/profile";
import { isShortType, type HubInboxRow, type InboxContent, type InboxSort, type InboxStatus } from "../hubApi";
import { useHeartComment, useHubInbox, useInboxRowPatch, usePinComment } from "../hooks/useHub";
import { HubHead } from "./HubFrame";
import { HubError, HubSkeleton, InboxEmpty } from "./HubEmpty";
import { PillGroup, useAnchoredMenu, useDismiss } from "./Pills";

function readStatus(v: string | null): InboxStatus {
  return v === "all" ? "all" : "unanswered";
}
function readContent(v: string | null): InboxContent {
  return v === "videos" || v === "flicks" || v === "posts" ? v : "all";
}
function readSort(v: string | null): InboxSort {
  return v === "relevant" ? "relevant" : "newest";
}

function postHref(post: HubInboxRow["post"]): string {
  if (isShortType(post.content_type)) return `/reels?reelId=${post.id}`;
  if (post.content_type === "long_video" || post.content_type === "video") return `/posttube/watch/${post.id}`;
  return `/post/${post.id}`;
}

/**
  /posttube/hub/conversations?status=unanswered|all&content=videos|flicks|posts|all&sort=newest|relevant&post=<id>
  `post` narrows the loaded rows client-side (the inbox has no post filter).
*/
export function ConversationsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = readStatus(params.get("status"));
  const content = readContent(params.get("content"));
  const sort = readSort(params.get("sort"));
  const postFilter = params.get("post");
  const me = useAuthUser();

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (v === null) next.delete(k);
    else next.set(k, v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const inbox = useHubInbox(status, content, sort);
  const rows = useMemo(() => (postFilter ? inbox.rows.filter((r) => r.post.id === postFilter) : inbox.rows), [inbox.rows, postFilter]);
  const authorIds = useMemo(() => [...new Set(rows.map((r) => r.comment.author_id).filter(Boolean))], [rows]);
  const profiles = useBatchProfiles(authorIds);
  const filteredPostTitle = postFilter ? inbox.rows.find((r) => r.post.id === postFilter)?.post.title : null;

  return (
    <>
      <HubHead title="Conversations" sub="Comments on your videos, shorts and posts. Reply inline, heart, pin, or hide a user." />
      <div className="hub-toolbar">
        <PillGroup
          label="Answered"
          value={status}
          options={[
            { id: "unanswered", label: "Unanswered" },
            { id: "all", label: "All" },
          ]}
          onChange={(v) => setParam("status", v === "unanswered" ? null : v)}
        />
        <PillGroup
          label="Content"
          value={content}
          options={[
            { id: "all", label: "Everything" },
            { id: "videos", label: "Videos" },
            { id: "flicks", label: "Shorts" },
            { id: "posts", label: "Posts" },
          ]}
          onChange={(v) => setParam("content", v === "all" ? null : v)}
        />
        <PillGroup
          label="Order"
          value={sort}
          options={[
            { id: "newest", label: "Newest" },
            { id: "relevant", label: "Relevant" },
          ]}
          onChange={(v) => setParam("sort", v === "newest" ? null : v)}
        />
        {postFilter ? (
          <button type="button" className="hub-pill is-on" onClick={() => setParam("post", null)} title="Show every video">
            {filteredPostTitle ?? "One video"} ×
          </button>
        ) : null}
      </div>

      {inbox.isPending ? (
        <HubSkeleton rows={5} height={72} />
      ) : inbox.isError ? (
        <HubError />
      ) : rows.length === 0 ? (
        <div className="hub-card">
          <InboxEmpty unanswered={status === "unanswered"} />
        </div>
      ) : (
        <div className="hub-card">
          {rows.map((row) => (
            <Thread key={row.comment.id} row={row} profile={profiles.data?.get(row.comment.author_id)} myId={me?.id} />
          ))}
        </div>
      )}

      {inbox.hasNextPage ? (
        <div className="hub-more">
          <button type="button" className="hub-btn" onClick={() => inbox.fetchNextPage()} disabled={inbox.isFetchingNextPage}>
            {inbox.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </>
  );
}

function Thread({ row, profile, myId }: { row: HubInboxRow; profile: UserProfile | undefined; myId?: string }) {
  const toast = useGlobalToast();
  const { comment, post } = row;
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "mute" | "block" | null>(null);
  const menuRef = useDismiss(menu, () => setMenu(false));
  const anchored = useAnchoredMenu(menu, "right");
  const heart = useHeartComment();
  const pin = usePinComment();
  const del = useDeleteComment();
  const mute = useMuteUser();
  const block = useBlockUser();
  const rowPatch = useInboxRowPatch();
  const replies = useCommentReplies(comment.id, showReplies);
  const replyItems = flattenReplies(replies.data);
  const replyAuthorIds = useMemo(() => [...new Set(replyItems.map((r) => r.author_id).filter(Boolean))], [replyItems]);
  const replyProfiles = useBatchProfiles(replyAuthorIds);

  const name = profile?.display_name || profile?.username || comment.author_id.slice(0, 8);
  const avatar = profile?.avatar_media_id ? mediaServeUrl(profile.avatar_media_id) : null;

  const runConfirm = () => {
    if (confirm === "delete") {
      del.mutate(
        { commentId: comment.id, postId: post.id },
        {
          onSuccess: () => {
            rowPatch.remove(comment.id);
            setConfirm(null);
            toast({ type: "success", title: "Comment deleted" });
          },
          onError: () => toast({ type: "error", title: "Could not delete" }),
        },
      );
    } else if (confirm === "mute") {
      mute.mutate(
        { muted_id: comment.author_id },
        {
          onSuccess: () => {
            setConfirm(null);
            toast({ type: "success", title: `${name} is hidden`, description: "Their comments stay, you no longer see them in feeds." });
          },
        },
      );
    } else if (confirm === "block" && profile?.username) {
      block.mutate(profile.username, {
        onSuccess: () => {
          setConfirm(null);
          toast({ type: "success", title: `${name} is blocked` });
        },
      });
    }
  };

  return (
    <article className={`hub-thread ${comment.pinned ? "is-pinned" : ""}`} aria-label={`Comment by ${name}`}>
      <span className="hub-avatar" aria-hidden="true">
        {avatar ? <img src={avatar} alt="" /> : name.charAt(0).toUpperCase()}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="hub-thread-head">
          <span className="hub-thread-name">{name}</span>
          {profile?.username ? <span>@{profile.username}</span> : null}
          <span>·</span>
          <span>{timeAgo(comment.created_at)}</span>
          {comment.pinned ? <span className="hub-tag hub-tag-info">Pinned</span> : null}
          {row.author_replied ? <span className="hub-tag hub-tag-success">Answered</span> : null}
          {comment.hearted ? <span className="hub-tag hub-tag-danger">♥ by you</span> : null}
        </div>
        <div className="hub-thread-body">
          <MentionText body={comment.body} />
        </div>
        <Link href={postHref(post)} className="hub-thread-post" title={post.title}>
          {post.cover_media_id ? <img src={mediaServeUrl(post.cover_media_id)} alt="" /> : null}
          <span>{post.title}</span>
        </Link>
        <div className="hub-thread-actions">
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => setReplying((r) => !r)} aria-expanded={replying}>
            <MessageSquareReply /> Reply
          </button>
          <button
            type="button"
            className={`hub-icon-btn ${comment.hearted ? "is-on" : ""}`}
            aria-pressed={comment.hearted}
            aria-label={comment.hearted ? "Remove heart" : "Heart this comment"}
            title="Creator heart"
            disabled={heart.isPending}
            onClick={() => heart.mutate({ commentId: comment.id, on: !comment.hearted }, { onError: () => toast({ type: "error", title: "Could not heart that" }) })}
          >
            <Heart fill={comment.hearted ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            className={`hub-icon-btn ${comment.pinned ? "is-on" : ""}`}
            aria-pressed={comment.pinned}
            aria-label={comment.pinned ? "Unpin" : "Pin to the top"}
            title={comment.pinned ? "Unpin" : "Pin (one per video)"}
            disabled={pin.isPending}
            onClick={() => pin.mutate({ commentId: comment.id, on: !comment.pinned }, { onError: () => toast({ type: "error", title: "Could not pin that" }) })}
          >
            {comment.pinned ? <PinOff /> : <Pin />}
          </button>
          {comment.reply_count > 0 ? (
            <button type="button" className="hub-btn hub-btn-sm" onClick={() => setShowReplies((s) => !s)} aria-expanded={showReplies}>
              {showReplies ? "Hide" : "Show"} {formatCount(comment.reply_count)} {comment.reply_count === 1 ? "reply" : "replies"}
            </button>
          ) : null}
          <div className="hub-vis" ref={menuRef} style={{ marginLeft: "auto", position: "relative" }}>
            <button ref={anchored.buttonRef} type="button" className="hub-icon-btn" aria-haspopup="menu" aria-expanded={menu} aria-label="More" onClick={() => setMenu((m) => !m)}>
              <MoreHorizontal />
            </button>
            {menu ? (
              <div className="hub-menu" style={anchored.style} role="menu">
                <button type="button" role="menuitem" className="hub-menu-item" onClick={() => { setMenu(false); setConfirm("mute"); }}>
                  <VolumeX /> Hide user
                </button>
                <button type="button" role="menuitem" className="hub-menu-item" disabled={!profile?.username} onClick={() => { setMenu(false); setConfirm("block"); }}>
                  <UserX /> Block user
                </button>
                <div className="hub-menu-sep" />
                <button type="button" role="menuitem" className="hub-menu-item is-danger" onClick={() => { setMenu(false); setConfirm("delete"); }}>
                  <Trash2 /> Delete comment
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {replying ? (
          <ReplyComposer
            postId={post.id}
            parentId={comment.id}
            myId={myId}
            onDone={() => {
              setReplying(false);
              rowPatch.markReplied(comment.id);
              toast({ type: "success", title: "Reply posted" });
            }}
            onCancel={() => setReplying(false)}
            onError={() => toast({ type: "error", title: "Could not post the reply" })}
          />
        ) : null}

        {showReplies ? (
          <div className="hub-thread-replies">
            {replies.isPending ? (
              <HubSkeleton rows={2} height={20} />
            ) : replyItems.length === 0 ? (
              <span className="hub-hint">No replies loaded.</span>
            ) : (
              replyItems.map((r) => <Reply key={r.id} item={r} mine={r.author_id === myId} profile={replyProfiles.data?.get(r.author_id)} />)
            )}
            {replies.hasNextPage ? (
              <button type="button" className="hub-btn hub-btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => replies.fetchNextPage()} disabled={replies.isFetchingNextPage}>
                More replies
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? "Delete this comment?" : confirm === "mute" ? `Hide ${name}?` : `Block ${name}?`}
        body={
          confirm === "delete"
            ? "It disappears for everyone, with its replies."
            : confirm === "mute"
              ? "You stop seeing them in your feeds. They are not told."
              : "They can no longer see or comment on your content."
        }
        confirmLabel={confirm === "delete" ? "Delete" : confirm === "mute" ? "Hide" : "Block"}
        danger
        pending={del.isPending || mute.isPending || block.isPending}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </article>
  );
}

function Reply({ item, mine, profile }: { item: CommentItem; mine: boolean; profile: UserProfile | undefined }) {
  const name = mine ? "You" : profile?.display_name || profile?.username || item.author_id.slice(0, 8);
  return (
    <div className="hub-reply">
      <span className="hub-reply-name">{name}</span>
      <MentionText body={item.body || item.text || ""} />
      <span className="hub-hint" style={{ marginLeft: 6 }}>
        {timeAgo(item.created_at)}
      </span>
    </div>
  );
}
