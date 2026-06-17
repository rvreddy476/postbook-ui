'use client';

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useComments, useAddComment, useCreateReply, useDeleteComment, useEditComment, useToggleCommentLike, useToggleCommentDislike } from '@/hooks/usePostComments';
import { useCommentsAround } from '@/hooks/useCommentsAround';
import { useMyProfile, useUserProfile } from '@/hooks/useEditProfile';
import { useSubmitReport, REPORT_REASONS } from '@/hooks/useReport';
import { ThumbsUp, ThumbsDown, Smile, Trash2, Pencil, Send, MessageCircle, Flag, X, Check } from 'lucide-react';
import type { CommentItem } from '@/types/profile';
import data from '@emoji-mart/data';

const EmojiPicker = lazy(() => import('@emoji-mart/react'));

// Resolves a comment author's display name and avatar via cached profile lookup.
const useCommentAuthor = (authorId: string, myId?: string, myName?: string, myAvatar?: string) => {
  const isOwn = myId === authorId;
  const { data: authorProfile } = useUserProfile(isOwn ? undefined : authorId);

  if (isOwn) {
    return {
      name: myName || 'You',
      avatar: myAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId.slice(0, 8)}`,
    };
  }

  const resolvedAvatar = authorProfile?.avatar_media_id
    ? `/v1/media/${authorProfile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId.slice(0, 8)}`;

  return {
    name: authorProfile?.display_name || `User ${authorId.slice(0, 6)}`,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div ref={dialogRef} className="w-[340px] rounded-2xl bg-brand-card p-6 shadow-2xl text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-[15px] font-bold text-brand-text">Report Submitted</h3>
          <p className="mt-1 text-[13px] text-brand-highlight">Thanks for helping keep our community safe. Our team will review this shortly.</p>
          <button onClick={onClose}
            className="mt-4 w-full rounded-full bg-brand-text py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-text/90">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
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
              className="mt-3 w-full rounded-xl bg-brand-secondary px-3.5 py-2.5 text-[13px] text-brand-text placeholder:text-brand-text/60 outline-none ring-1 ring-brand-secondary focus:ring-brand-text/40 transition resize-none"
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

/* ── Reply Component ───────────────────────────────────────── */

const ReplyItem: React.FC<{
  reply: CommentItem;
  postId: string;
  postAuthorId: string;
  myId?: string;
  myName?: string;
  myAvatar?: string;
}> = ({ reply, postId, myId, myName, myAvatar }) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(reply.body || reply.text || '');
  const [reportOpen, setReportOpen] = useState(false);

  const deleteMutation = useDeleteComment();
  const editMutation = useEditComment();
  const likeMutation = useToggleCommentLike();
  const dislikeMutation = useToggleCommentDislike();
  const author = useCommentAuthor(reply.author_id, myId, myName, myAvatar);

  const isOwn = myId === reply.author_id;
  const replyBody = reply.body || reply.text || '';
  const [localLikes, setLocalLikes] = useState(reply.like_count ?? 0);
  const [localDislikes, setLocalDislikes] = useState(reply.dislike_count ?? 0);
  const [localLiked, setLocalLiked] = useState(false);
  const [localDisliked, setLocalDisliked] = useState(false);

  const handleLike = () => {
    if (localLiked) { setLocalLiked(false); setLocalLikes(c => Math.max(0, c - 1)); }
    else {
      if (localDisliked) { setLocalDisliked(false); setLocalDislikes(c => Math.max(0, c - 1)); }
      setLocalLiked(true); setLocalLikes(c => c + 1);
    }
    likeMutation.mutate({ commentId: reply.id, postId });
  };

  const handleDislike = () => {
    if (localDisliked) { setLocalDisliked(false); setLocalDislikes(c => Math.max(0, c - 1)); }
    else {
      if (localLiked) { setLocalLiked(false); setLocalLikes(c => Math.max(0, c - 1)); }
      setLocalDisliked(true); setLocalDislikes(c => c + 1);
    }
    dislikeMutation.mutate({ commentId: reply.id, postId });
  };

  return (
    <div className="ml-10 mt-1.5 py-1.5">
      {/* Header: avatar + name + time */}
      <div className="flex items-center gap-2">
        <img src={author.avatar} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
        <span className="text-[12px] font-semibold text-brand-text">@{author.name}</span>
        <span className="text-[11px] text-brand-text/60">{timeAgo(reply.created_at)}</span>
      </div>

      {/* Body */}
      {editing ? (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!editText.trim() || editMutation.isPending) return;
          await editMutation.mutateAsync({ commentId: reply.id, body: editText.trim(), postId });
          setEditing(false);
        }} className="mt-1 ml-7 space-y-2">
          <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)}
            className="w-full rounded-xl bg-brand-secondary px-3 py-1.5 text-[13px] text-brand-text outline-none ring-1 ring-brand-secondary focus:ring-brand-text/40 transition" autoFocus />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-brand-highlight font-medium px-2.5 py-1 rounded-full hover:bg-brand-secondary transition">Cancel</button>
            <button type="submit" disabled={editMutation.isPending || !editText.trim()}
              className="text-[11px] font-semibold px-2.5 py-1 bg-brand-text text-white rounded-full disabled:opacity-40">Save</button>
          </div>
        </form>
      ) : (
        <p className="text-[13px] text-brand-text mt-0.5 ml-7 leading-relaxed">{replyBody}</p>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-3 mt-1 ml-7">
          <button onClick={handleLike} className="flex items-center gap-1 text-brand-highlight hover:text-brand-text transition">
            <ThumbsUp className={`w-3 h-3 ${localLiked ? 'fill-slate-800 text-brand-text' : ''}`} />
            {localLikes > 0 && <span className="text-[11px]">{localLikes}</span>}
          </button>
          <button onClick={handleDislike} className="flex items-center gap-1 text-brand-highlight hover:text-brand-text transition">
            <ThumbsDown className={`w-3 h-3 ${localDisliked ? 'fill-slate-800 text-brand-text' : ''}`} />
            {localDislikes > 0 && <span className="text-[11px]">{localDislikes}</span>}
          </button>
          {isOwn && canEdit(reply.created_at) && (
            <button onClick={() => { setEditing(true); setEditText(replyBody); }} className="text-[11px] text-brand-highlight hover:text-brand-text transition">Edit</button>
          )}
          {isOwn && (
            <button onClick={() => { if (confirm('Delete this reply?')) deleteMutation.mutate({ commentId: reply.id, postId }); }}
              className="text-[11px] text-brand-highlight hover:text-red-600 transition">Delete</button>
          )}
          {!isOwn && (
            <button onClick={() => setReportOpen(true)} className="text-[11px] text-brand-highlight hover:text-red-600 transition">Report</button>
          )}
        </div>
      )}

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="comment" targetId={reply.id} />
    </div>
  );
};

/* ── Single Comment Component ──────────────────────────────── */

const SingleComment: React.FC<{
  comment: CommentItem;
  postId: string;
  postAuthorId: string;
  myId?: string;
  myName?: string;
  myAvatar?: string;
  isFocused?: boolean;
}> = ({ comment, postId, postAuthorId, myId, myName, myAvatar, isFocused }) => {
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body || comment.text || '');
  const [localReply, setLocalReply] = useState<CommentItem | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  const replyMutation = useCreateReply();
  const deleteMutation = useDeleteComment();
  const editMutation = useEditComment();
  const likeMutation = useToggleCommentLike();
  const dislikeMutation = useToggleCommentDislike();
  const author = useCommentAuthor(comment.author_id, myId, myName, myAvatar);
  const [localLikes, setLocalLikes] = useState(comment.like_count ?? 0);
  const [localDislikes, setLocalDislikes] = useState(comment.dislike_count ?? 0);
  const [localLiked, setLocalLiked] = useState(false);
  const [localDisliked, setLocalDisliked] = useState(false);

  const isOwn = myId === comment.author_id;
  const isPostOwner = myId === postAuthorId;
  const visibleReply = comment.reply || localReply;
  const canReply = isPostOwner && !comment.is_reply && !visibleReply && comment.reply_count === 0;
  const commentBody = comment.body || comment.text || '';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    if (showEmojiPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const handleLike = () => {
    if (localLiked) { setLocalLiked(false); setLocalLikes(c => Math.max(0, c - 1)); }
    else {
      if (localDisliked) { setLocalDisliked(false); setLocalDislikes(c => Math.max(0, c - 1)); }
      setLocalLiked(true); setLocalLikes(c => c + 1);
    }
    likeMutation.mutate({ commentId: comment.id, postId });
  };

  const handleDislike = () => {
    if (localDisliked) { setLocalDisliked(false); setLocalDislikes(c => Math.max(0, c - 1)); }
    else {
      if (localLiked) { setLocalLiked(false); setLocalLikes(c => Math.max(0, c - 1)); }
      setLocalDisliked(true); setLocalDislikes(c => c + 1);
    }
    dislikeMutation.mutate({ commentId: comment.id, postId });
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || replyMutation.isPending) return;
    try {
      const result = await replyMutation.mutateAsync({ commentId: comment.id, text: replyText.trim(), postId });
      setLocalReply(result.reply);
      setReplyText('');
      setShowReplyInput(false);
      setShowEmojiPicker(false);
    } catch {
      // Keep input open for retry
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim() || editMutation.isPending) return;
    await editMutation.mutateAsync({ commentId: comment.id, body: editText.trim(), postId });
    setEditing(false);
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    setReplyText(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  return (
    <div
      id={`comment-${comment.id}`}
      className={`px-4 py-3 transition-colors duration-300 ${
        isFocused ? 'bg-blue-50/50' : ''
      }`}
    >
      {/* Header row: small avatar + name + time + 3-dot */}
      <div className="flex items-center gap-2">
        <img src={author.avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
        <span className="text-[12px] font-semibold text-brand-text">@{author.name}</span>
        <span className="text-[11px] text-brand-text/60">{timeAgo(comment.created_at)}</span>
      </div>

      {/* Comment body */}
      <div className="mt-1 ml-8">
        {editing ? (
          <form onSubmit={handleEdit} className="space-y-2">
            <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-xl bg-brand-secondary px-3 py-2 text-[13px] text-brand-text outline-none ring-1 ring-brand-secondary focus:ring-brand-text/40 transition" autoFocus />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-brand-highlight font-medium px-3 py-1 rounded-full hover:bg-brand-secondary transition">Cancel</button>
              <button type="submit" disabled={editMutation.isPending || !editText.trim()}
                className="text-[12px] font-semibold px-3 py-1 bg-brand-text text-white rounded-full disabled:opacity-40 transition hover:bg-brand-text/90">Save</button>
            </div>
          </form>
        ) : (
          <p className="text-[13px] text-brand-text leading-relaxed">{commentBody}</p>
        )}

        {/* Action bar: Like  Dislike  Reply  Report  |  Edit  Delete */}
        {!editing && (
          <div className="flex items-center gap-3.5 mt-2">
            <button onClick={handleLike} className="flex items-center gap-1 text-brand-highlight hover:text-brand-text transition">
              <ThumbsUp className={`w-3.5 h-3.5 ${localLiked ? 'fill-slate-800 text-brand-text' : ''}`} />
              {localLikes > 0 && <span className="text-[11px]">{localLikes}</span>}
            </button>

            <button onClick={handleDislike} className="flex items-center gap-1 text-brand-highlight hover:text-brand-text transition">
              <ThumbsDown className={`w-3.5 h-3.5 ${localDisliked ? 'fill-slate-800 text-brand-text' : ''}`} />
              {localDislikes > 0 && <span className="text-[11px]">{localDislikes}</span>}
            </button>

            {canReply && (
              <button onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-[12px] font-semibold text-brand-highlight hover:text-brand-text transition">
                Reply
              </button>
            )}

            {!isOwn && (
              <button onClick={() => setReportOpen(true)}
                className="flex items-center gap-1 text-[12px] text-brand-text/60 hover:text-red-600 transition">
                <Flag className="w-3 h-3" />
                <span>Report</span>
              </button>
            )}

            {isOwn && canEdit(comment.created_at) && (
              <button onClick={() => { setEditing(true); setEditText(commentBody); }}
                className="flex items-center gap-1 text-[12px] text-brand-text/60 hover:text-brand-text transition">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}

            {isOwn && (
              <button onClick={() => { if (confirm('Delete this comment?')) deleteMutation.mutate({ commentId: comment.id, postId }); }}
                className="flex items-center gap-1 text-[12px] text-brand-text/60 hover:text-red-600 transition">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        )}

        {/* Reply input */}
        {showReplyInput && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="relative" ref={emojiRef}>
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-1.5 rounded-full hover:bg-brand-secondary transition">
                  <Smile className="w-4 h-4 text-brand-text/60" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-10 left-0 z-20">
                    <Suspense fallback={<div className="w-[352px] h-[435px] bg-brand-card rounded-2xl shadow-xl flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand-divider border-t-brand-text/80 rounded-full animate-spin" /></div>}>
                      <EmojiPicker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" perLine={9} maxFrequentRows={2} />
                    </Suspense>
                  </div>
                )}
              </div>
              <form onSubmit={handleReply} className="flex-1">
                <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply..."
                  autoFocus
                  className="w-full rounded-full bg-brand-secondary px-4 py-2 text-[13px] text-brand-text placeholder:text-brand-text/60 outline-none ring-1 ring-brand-secondary focus:ring-brand-text/40 transition" />
              </form>
              <button onClick={handleReply} disabled={!replyText.trim() || replyMutation.isPending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-text text-white disabled:opacity-40 transition hover:bg-brand-text/90">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <button type="button" onClick={() => { setShowReplyInput(false); setReplyText(''); setShowEmojiPicker(false); }}
              className="mt-1.5 ml-10 text-[11px] text-brand-text/60 hover:text-brand-highlight transition">Cancel</button>
          </div>
        )}
      </div>

      {/* Inline reply */}
      {visibleReply && (
        <ReplyItem reply={visibleReply} postId={postId} postAuthorId={postAuthorId} myId={myId} myName={myName} myAvatar={myAvatar} />
      )}

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="comment" targetId={comment.id} />
    </div>
  );
};

/* ── Main CommentSection ───────────────────────────────────── */

const CommentSection: React.FC<CommentSectionProps> = ({ postId, postAuthorId = '', commentsCount, alwaysExpanded = false, focusCommentId }) => {
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded || !!focusCommentId);
  const [commentText, setCommentText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [highlightId, setHighlightId] = useState<string | undefined>(focusCommentId);
  const scrolledRef = useRef(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useMyProfile();

  const { data: aroundComments, isLoading: aroundLoading } = useCommentsAround(
    focusCommentId ? postId : undefined,
    focusCommentId,
  );
  const { data: normalComments, isLoading: normalLoading } = useComments(
    postId,
    isExpanded && !focusCommentId,
  );

  const comments = focusCommentId ? aroundComments : normalComments;
  const isLoading = focusCommentId ? aroundLoading : normalLoading;

  const addComment = useAddComment();

  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=User';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    if (showEmojiPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

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
    await addComment.mutateAsync({ postId, text: commentText.trim() });
    setCommentText('');
    setShowEmojiPicker(false);
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    setCommentText(prev => prev + emoji.native);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
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
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-brand-secondary">
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
          <SingleComment
            key={comment.id}
            comment={comment}
            postId={postId}
            postAuthorId={postAuthorId}
            myId={profile?.id}
            myName={profile?.display_name}
            myAvatar={avatarSrc}
            isFocused={highlightId === comment.id}
          />
        ))}
      </div>

      {/* Sticky bottom input */}
      <div className="shrink-0 border-t border-brand-divider bg-brand-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <img src={avatarSrc} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          <form onSubmit={handleSubmit} className="relative flex flex-1 items-center">
            <div className="relative" ref={emojiRef}>
              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1.5 rounded-full hover:bg-brand-secondary transition mr-1">
                <Smile className="w-[18px] h-[18px] text-brand-text/60" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-20">
                  <Suspense fallback={<div className="w-[352px] h-[435px] bg-brand-card rounded-2xl shadow-xl flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand-divider border-t-brand-text/80 rounded-full animate-spin" /></div>}>
                    <EmojiPicker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" perLine={9} maxFrequentRows={2} />
                  </Suspense>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 rounded-full bg-brand-secondary px-4 py-2.5 text-[13px] text-brand-text placeholder:text-brand-text/60 outline-none ring-1 ring-transparent focus:ring-brand-divider focus:bg-brand-card transition"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || addComment.isPending}
              className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                commentText.trim()
                  ? 'bg-brand-text text-brand-bg shadow-sm hover:opacity-90 scale-100'
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
