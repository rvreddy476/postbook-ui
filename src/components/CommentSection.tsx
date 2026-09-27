'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useComments, useAddComment, useDeleteComment, useEditComment, useCommentReplies, useSetCommentReaction, flattenReplies } from '@/hooks/usePostComments';
import { useCommentsAround } from '@/hooks/useCommentsAround';
import { usePostRoom } from '@/hooks/usePostRoom';
import { useMyProfile, useUserProfile } from '@/hooks/useEditProfile';
import { useSubmitReport, REPORT_REASONS } from '@/hooks/useReport';
import { useGlobalToast } from '@/contexts/ToastContext';
import { Smile, Trash2, Pencil, Send, MessageCircle, Flag, X, Check, CornerDownRight } from 'lucide-react';
import type { CommentItem } from '@/types/profile';
import CommentReactions from '@/components/comments/CommentReactions';
import MentionInput from '@/components/comments/MentionInput';
import MentionText from '@/components/comments/MentionText';
import ReplyComposer from '@/components/comments/ReplyComposer';
import EmojiPickerPopover from '@/components/comments/EmojiPickerPopover';

// Resolves a comment author's display name, username and avatar via cached profile lookup.
const useCommentAuthor = (authorId: string, myId?: string, myName?: string, myAvatar?: string, myUsername?: string) => {
  const isOwn = myId === authorId;
  const { data: authorProfile } = useUserProfile(isOwn ? undefined : authorId);

  if (isOwn) {
    return {
      name: myName || 'You',
      username: myUsername,
      avatar: myAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId.slice(0, 8)}`,
    };
  }

  const resolvedAvatar = authorProfile?.avatar_media_id
    ? `/v1/media/${authorProfile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId.slice(0, 8)}`;

  return {
    name: authorProfile?.display_name || `User ${authorId.slice(0, 6)}`,
    username: authorProfile?.username || undefined,
    avatar: resolvedAvatar,
  };
};

interface CommentSectionProps {
  postId: string;
  postAuthorId?: string;
  commentsCount: number;
  alwaysExpanded?: boolean;
  focusCommentId?: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

function canEdit(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  return Date.now() - created < 15 * 60 * 1000;
}

/** "View 3 replies" / "View 1 reply". */
export function repliesLabel(count: number): string {
  return `View ${count} ${count === 1 ? 'reply' : 'replies'}`;
}

/* ── Report Dialog ─────────────────────────────────────────── */

function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: 'comment' | 'post' | 'reel' | 'video';
  targetId: string;
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const reportMutation = useSubmitReport();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setSelectedReason(''); setDescription(''); setSubmitted(false); }
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose();
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    await reportMutation.mutateAsync({
      targetType,
      targetId,
      reason: selectedReason as Parameters<typeof reportMutation.mutateAsync>[0]['reason'],
      description,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs">
        <div ref={dialogRef} className="w-[340px] rounded-2xl bg-brand-card p-6 shadow-2xl text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-[15px] font-bold text-brand-text">Report Submitted</h3>
          <p className="mt-1 text-[13px] text-brand-highlight">Thanks for helping keep our community safe. Our team will review this shortly.</p>
          <button onClick={onClose}
            className="mt-4 w-full rounded-full bg-primary-ink py-2.5 text-[13px] font-semibold text-white transition hover:bg-primary-ink/90">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs">
      <div ref={dialogRef} className="w-[380px] rounded-2xl bg-brand-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-brand-divider px-5 py-3.5">
          <h3 className="text-[14px] font-bold text-brand-text">Report</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 transition hover:bg-brand-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12px] text-brand-highlight mb-3">Why are you reporting this {targetType}?</p>
          <div className="space-y-1.5">
            {REPORT_REASONS.map((r) => (
              <button key={r.value} onClick={() => setSelectedReason(r.value)}
                className={`w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] transition ${
                  selectedReason === r.value
                    ? 'bg-brand-text text-white font-medium'
                    : 'bg-brand-secondary text-brand-text hover:bg-brand-secondary'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
          {selectedReason === 'other' && (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us more..."
              rows={2}
              className="mt-3 w-full rounded-xl bg-brand-secondary px-3.5 py-2.5 text-[13px] text-brand-text placeholder:text-brand-text/60 outline-hidden ring-1 ring-brand-secondary focus:ring-brand-text/40 transition resize-none"
            />
          )}
        </div>
        <div className="border-t border-brand-divider px-5 py-3">
          <button onClick={handleSubmit}
            disabled={!selectedReason || reportMutation.isPending}
            className="w-full rounded-full bg-red-600 py-2.5 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-40">
            {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── One comment or reply ──────────────────────────────────── */

interface Viewer {
  myId?: string;
  myName?: string;
  myUsername?: string;
  myAvatar?: string;
}

interface CommentNodeProps extends Viewer {
  comment: CommentItem;
  postId: string;
  postAuthorId: string;
  /** The top-level comment a reply attaches to; a top-level comment is its own parent. */
  parentId: string;
  isReply: boolean;
  isFocused?: boolean;
  notifyError: (title: string) => void;
}

/**
 * Author row, body with linked mentions, emoji reactions, Reply / Report /
 * Edit / Delete, and an inline reply composer. Top-level comments also own
 * their replies list (first-reply preview, "View N replies", paging).
 */
export const CommentNode: React.FC<CommentNodeProps> = ({ comment, postId, postAuthorId, parentId, isReply, isFocused, myId, myName, myUsername, myAvatar, notifyError }) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body || comment.text || '');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);

  const deleteMutation = useDeleteComment();
  const editMutation = useEditComment();
  const setReaction = useSetCommentReaction();
  const author = useCommentAuthor(comment.author_id, myId, myName, myAvatar, myUsername);
  const isOwn = myId === comment.author_id;
  const body = comment.body || comment.text || '';

  const replyCount = comment.reply_count ?? 0;
  const replies = useCommentReplies(isReply ? undefined : comment.id, !isReply && repliesOpen);
  const loadedReplies = flattenReplies(replies.data);
  const showList = !isReply && repliesOpen && loadedReplies.length > 0;
  const preview = !isReply && !showList ? comment.reply : null;
  const canToggle = !isReply && replyCount > 0 && (replyCount > 1 || !comment.reply);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim() || editMutation.isPending) return;
    try {
      await editMutation.mutateAsync({ commentId: comment.id, body: editText.trim(), postId });
      setEditing(false);
    } catch { notifyError('Could not save your edit'); }
  };

  const react = (emoji: string | null) =>
    setReaction.mutateAsync({ commentId: comment.id, emoji, postId }).catch(error => { notifyError('Could not save reaction'); throw error; });

  const replyPrefill = isReply && author.username ? `@${author.username} ` : '';
  const indent = isReply ? 'ml-7' : 'ml-8';

  return (
    <div
      id={`comment-${comment.id}`}
      className={isReply
        ? 'mt-1.5 py-1.5'
        : `px-4 py-3 transition-colors duration-300 ${isFocused ? 'bg-brand-tint' : ''}`}
    >
      {/* Header row: small avatar + name + time */}
      <div className="flex items-center gap-2">
        <img src={author.avatar} alt="" className={`${isReply ? 'w-5 h-5' : 'w-6 h-6'} rounded-full object-cover shrink-0`} />
        <span className="text-[12px] font-semibold text-brand-text">{author.username ? `@${author.username}` : author.name}</span>
        <span className="text-[11px] text-brand-text/60">{timeAgo(comment.created_at)}</span>
      </div>

      <div className={`mt-1 ${indent}`}>
        {editing ? (
          <form onSubmit={handleEdit} className="space-y-2">
            <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edit comment"
              className="w-full rounded-xl bg-brand-secondary px-3 py-2 text-[13px] text-brand-text outline-hidden ring-1 ring-brand-secondary focus:ring-brand-text/40 transition" autoFocus />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-brand-highlight font-medium px-3 py-1 rounded-full hover:bg-brand-secondary transition">Cancel</button>
              <button type="submit" disabled={editMutation.isPending || !editText.trim()}
                className="text-[12px] font-semibold px-3 py-1 bg-primary-ink text-white rounded-full disabled:opacity-40 transition hover:bg-primary-ink/90">Save</button>
            </div>
          </form>
        ) : (
          <p className="text-[13px] text-brand-text leading-relaxed break-words"><MentionText body={body} /></p>
        )}

        {/* Action bar: Reactions  Reply  Report  |  Edit  Delete */}
        {!editing && (
          <div data-comment-actions className="flex flex-wrap items-center gap-3 mt-1.5">
            <CommentReactions item={comment} onChange={react} disabled={setReaction.isPending} />

            <button type="button" onClick={() => setShowReplyInput(open => !open)} aria-expanded={showReplyInput}
              className="text-[12px] font-semibold text-brand-highlight hover:text-brand-text transition">
              Reply
            </button>

            {!isOwn && (
              <button type="button" onClick={() => setReportOpen(true)}
                className="flex items-center gap-1 text-[12px] text-brand-text/60 hover:text-danger transition">
                <Flag className="w-3 h-3" />
                <span>Report</span>
              </button>
            )}

            {isOwn && canEdit(comment.created_at) && (
              <button type="button" onClick={() => { setEditing(true); setEditText(body); }}
                className="flex items-center gap-1 text-[12px] text-brand-text/60 hover:text-brand-text transition">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}

            {isOwn && (
              <button type="button" onClick={() => { if (confirm(isReply ? 'Delete this reply?' : 'Delete this comment?')) deleteMutation.mutate({ commentId: comment.id, postId }); }}
                className="flex items-center gap-1 text-[12px] text-brand-text/60 hover:text-danger transition">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        )}

        {showReplyInput && (
          <ReplyComposer postId={postId} parentId={parentId} prefill={replyPrefill} myId={myId}
            onDone={() => { setShowReplyInput(false); setRepliesOpen(true); }}
            onCancel={() => setShowReplyInput(false)}
            onError={() => notifyError('Reply was not sent. Your draft is still here.')} />
        )}
      </div>

      {/* Replies: preview, toggle, list */}
      {preview && (
        <div className="ml-10">
          <CommentNode comment={preview} postId={postId} postAuthorId={postAuthorId} parentId={comment.id} isReply
            myId={myId} myName={myName} myUsername={myUsername} myAvatar={myAvatar} notifyError={notifyError} />
        </div>
      )}

      {canToggle && (
        <button type="button" onClick={() => setRepliesOpen(open => !open)} aria-expanded={repliesOpen}
          className="ml-10 mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-brand-highlight hover:text-brand-text transition">
          <CornerDownRight className="w-3.5 h-3.5" />
          {repliesOpen ? 'Hide replies' : repliesLabel(replyCount)}
        </button>
      )}

      {!isReply && repliesOpen && replies.isLoading && (
        <div className="ml-10 mt-2 flex items-center gap-2 text-[12px] text-brand-text/60">
          <span className="comment-spinner" aria-hidden="true" /> Loading replies…
        </div>
      )}
      {!isReply && repliesOpen && replies.isError && (
        <div role="alert" className="ml-10 mt-2 text-[12px] text-brand-text/60">
          Replies could not load. <button type="button" className="underline" onClick={() => void replies.refetch()}>Try again</button>
        </div>
      )}

      {showList && (
        <div className="ml-10">
          {loadedReplies.map(reply => (
            <CommentNode key={reply.id} comment={reply} postId={postId} postAuthorId={postAuthorId} parentId={comment.id} isReply
              myId={myId} myName={myName} myUsername={myUsername} myAvatar={myAvatar} notifyError={notifyError} />
          ))}
          {replies.hasNextPage && (
            <button type="button" disabled={replies.isFetchingNextPage} onClick={() => void replies.fetchNextPage()}
              className="mt-1.5 text-[12px] font-semibold text-brand-highlight hover:text-brand-text transition disabled:opacity-40">
              {replies.isFetchingNextPage ? 'Loading…' : 'Load more replies'}
            </button>
          )}
        </div>
      )}

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="comment" targetId={comment.id} />
    </div>
  );
};

/* ── Main CommentSection ───────────────────────────────────── */

const CommentSection: React.FC<CommentSectionProps> = ({ postId, postAuthorId = '', commentsCount, alwaysExpanded = false, focusCommentId }) => {
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded || !!focusCommentId);
  usePostRoom(isExpanded ? postId : undefined, 15000);
  const [commentText, setCommentText] = useState('');
  const [submitError, setSubmitError] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [highlightId, setHighlightId] = useState<string | undefined>(focusCommentId);
  const scrolledRef = useRef(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useGlobalToast();
  const notifyError = (title: string) => { toast({ type: 'error', title }); };

  const { data: profile } = useMyProfile();

  const { data: aroundComments, isLoading: aroundLoading, isError: aroundError, refetch: retryAround } = useCommentsAround(
    focusCommentId ? postId : undefined,
    focusCommentId,
  );
  const { data: normalComments, isLoading: normalLoading, isError: normalError, refetch: retryNormal } = useComments(
    postId,
    isExpanded && !focusCommentId,
  );

  const comments = focusCommentId ? aroundComments : normalComments;
  const isLoading = focusCommentId ? aroundLoading : normalLoading;
  const loadError = focusCommentId ? aroundError : normalError;

  const addComment = useAddComment();

  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=User';

  useEffect(() => {
    if (!focusCommentId || !comments?.length || scrolledRef.current) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`comment-${focusCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        scrolledRef.current = true;
        setTimeout(() => setHighlightId(undefined), 3000);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [focusCommentId, comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || addComment.isPending) return;
    setSubmitError(false);
    const submitted = commentText.trim();
    try {
      await addComment.mutateAsync({ postId, text: submitted });
      setCommentText(current => current.trim() === submitted ? '' : current);
      setShowEmojiPicker(false);
    } catch { setSubmitError(true); }
  };

  const handleEmojiSelect = (native: string) => {
    const el = inputRef.current;
    const at = el?.selectionStart ?? commentText.length;
    setCommentText(prev => prev.slice(0, at) + native + prev.slice(at));
    setShowEmojiPicker(false);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + native.length, at + native.length); });
  };

  if (!isExpanded && !alwaysExpanded && !focusCommentId) {
    return (
      <div className="px-5 pb-4">
        {commentsCount > 0 && (
          <button onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-text/60 hover:text-brand-text transition">
            <MessageCircle className="w-3.5 h-3.5" />
            View all {commentsCount} comments
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-brand-card">
      {/* Comments list — scrollable */}
      <div data-comments-list className="flex-1 min-h-0 overflow-y-auto divide-y divide-brand-secondary">
        {loadError && <div role="alert" className="p-4 text-sm">Comments could not refresh. <button type="button" className="underline" onClick={() => { if(focusCommentId) void retryAround(); else void retryNormal(); }}>Try again</button></div>}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-brand-divider border-t-brand-text/80 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && comments && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-brand-secondary flex items-center justify-center mb-3">
              <MessageCircle className="w-5 h-5 text-brand-text/30" />
            </div>
            <p className="text-[13px] font-medium text-brand-text/60">No comments yet</p>
            <p className="text-[12px] text-brand-text/30 mt-0.5">Be the first to share your thoughts</p>
          </div>
        )}

        {comments?.map((comment: CommentItem) => (
          <CommentNode
            key={comment.id}
            comment={comment}
            postId={postId}
            postAuthorId={postAuthorId}
            parentId={comment.id}
            isReply={false}
            myId={profile?.id}
            myName={profile?.display_name}
            myUsername={profile?.username}
            myAvatar={avatarSrc}
            isFocused={highlightId === comment.id}
            notifyError={notifyError}
          />
        ))}
      </div>

      {/* Sticky bottom input */}
      {submitError && <p role="alert" className="px-4 py-2 text-sm text-danger">Comment was not confirmed. Your draft is still here.</p>}
      <div className="shrink-0 border-t border-brand-divider bg-brand-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <img src={avatarSrc} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
          <form onSubmit={handleSubmit} className="relative flex flex-1 items-center min-w-0">
            <button ref={emojiButtonRef} type="button" aria-label="Add emoji" aria-expanded={showEmojiPicker}
              onClick={() => setShowEmojiPicker(open => !open)}
              className="p-1.5 rounded-full hover:bg-brand-secondary transition mr-1 shrink-0">
              <Smile className="w-[18px] h-[18px] text-brand-text/60" />
            </button>
            {showEmojiPicker && (
              <EmojiPickerPopover anchorRef={emojiButtonRef} onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
            )}
            <MentionInput
              inputRef={inputRef}
              placement="top"
              aria-label="Write a comment"
              type="text"
              value={commentText}
              onValueChange={setCommentText}
              placeholder="Add a comment..."
              className="w-full min-w-0 rounded-full bg-brand-secondary px-4 py-2.5 text-[13px] text-brand-text placeholder:text-brand-text/60 outline-hidden ring-1 ring-transparent focus:ring-brand-divider focus:bg-brand-card transition"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || addComment.isPending}
              className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                commentText.trim()
                  ? 'bg-brand-text text-brand-bg shadow-xs hover:opacity-90 scale-100'
                  : 'bg-brand-secondary text-brand-text/30 scale-95'
              }`}
              aria-label="Post comment"
            >
              <Send className="w-4 h-4 -ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CommentSection;
