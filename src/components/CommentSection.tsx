'use client';

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useComments, useAddComment, useCreateReply, useDeleteComment, useEditComment, useToggleCommentLike, useToggleCommentDislike } from '@/hooks/usePostComments';
import { useCommentsAround } from '@/hooks/useCommentsAround';
import { useMyProfile, useUserProfile } from '@/hooks/useEditProfile';
import { ThumbsUp, ThumbsDown, MoreHorizontal, Smile, Trash2, Pencil } from 'lucide-react';
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
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return new Date(dateStr).toLocaleDateString();
}

function canEdit(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  return Date.now() - created < 15 * 60 * 1000; // 15 minutes
}

// --- Reply Component (flat style, indented) ---
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
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleLike = () => {
    if (localLiked) {
      setLocalLiked(false);
      setLocalLikes(c => Math.max(0, c - 1));
    } else {
      if (localDisliked) {
        setLocalDisliked(false);
        setLocalDislikes(c => Math.max(0, c - 1));
      }
      setLocalLiked(true);
      setLocalLikes(c => c + 1);
    }
    likeMutation.mutate({ commentId: reply.id, postId });
  };

  const handleDislike = () => {
    if (localDisliked) {
      setLocalDisliked(false);
      setLocalDislikes(c => Math.max(0, c - 1));
    } else {
      if (localLiked) {
        setLocalLiked(false);
        setLocalLikes(c => Math.max(0, c - 1));
      }
      setLocalDisliked(true);
      setLocalDislikes(c => c + 1);
    }
    dislikeMutation.mutate({ commentId: reply.id, postId });
  };

  return (
    <div className="flex gap-3 ml-12 py-2">
      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
        <img src={author.avatar} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!editText.trim() || editMutation.isPending) return;
            await editMutation.mutateAsync({ commentId: reply.id, body: editText.trim(), postId });
            setEditing(false);
          }} className="space-y-2">
            <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-sm text-gray-800 py-1" autoFocus />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-600 font-medium px-3 py-1">Cancel</button>
              <button type="submit" disabled={editMutation.isPending || !editText.trim()}
                className="text-sm font-medium px-3 py-1 bg-blue-600 text-white rounded-full disabled:opacity-50">Save</button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-gray-900">@{author.name}</span>
              <span className="text-xs text-gray-500">&middot; {timeAgo(reply.created_at)}</span>
            </div>
            <p className="text-sm text-gray-800 mt-0.5">{replyBody}</p>
            <div className="flex items-center gap-1 mt-1.5">
              <button onClick={handleLike} className="p-1.5 rounded-full hover:bg-gray-100">
                <ThumbsUp className={`w-3.5 h-3.5 ${localLiked ? 'fill-[#F2284D] text-[#F2284D]' : 'text-gray-600'}`} />
              </button>
              {localLikes > 0 && <span className="text-xs text-gray-600 mr-1">{localLikes}</span>}
              <button onClick={handleDislike} className="p-1.5 rounded-full hover:bg-gray-100">
                <ThumbsDown className={`w-3.5 h-3.5 ${localDisliked ? 'fill-gray-700 text-gray-700' : 'text-gray-600'}`} />
              </button>
              {localDislikes > 0 && <span className="text-xs text-gray-600 mr-1">{localDislikes}</span>}

              {isOwn && (
                <div className="relative ml-auto" ref={menuRef}>
                  <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-full hover:bg-gray-100">
                    <MoreHorizontal className="w-4 h-4 text-gray-500" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                      {canEdit(reply.created_at) && (
                        <button onClick={() => { setEditing(true); setEditText(replyBody); setShowMenu(false); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      <button onClick={() => { if (confirm('Delete this reply?')) deleteMutation.mutate({ commentId: reply.id, postId }); setShowMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-50">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- Single Comment Component ---
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
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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

  // Close menu/emoji on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    if (showMenu || showEmojiPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu, showEmojiPicker]);

  const handleLike = () => {
    if (localLiked) {
      setLocalLiked(false);
      setLocalLikes(c => Math.max(0, c - 1));
    } else {
      if (localDisliked) {
        setLocalDisliked(false);
        setLocalDislikes(c => Math.max(0, c - 1));
      }
      setLocalLiked(true);
      setLocalLikes(c => c + 1);
    }
    likeMutation.mutate({ commentId: comment.id, postId });
  };

  const handleDislike = () => {
    if (localDisliked) {
      setLocalDisliked(false);
      setLocalDislikes(c => Math.max(0, c - 1));
    } else {
      if (localLiked) {
        setLocalLiked(false);
        setLocalLikes(c => Math.max(0, c - 1));
      }
      setLocalDisliked(true);
      setLocalDislikes(c => c + 1);
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
      // Keep the input open on error so user can retry
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this comment?')) {
      deleteMutation.mutate({ commentId: comment.id, postId });
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
    <div id={`comment-${comment.id}`} className={`py-3 ${isFocused ? 'bg-blue-50 rounded-lg px-2 ring-2 ring-blue-200' : ''}`}>
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
          <img src={author.avatar} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <form onSubmit={handleEdit} className="space-y-2">
              <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-sm text-gray-800 py-1" autoFocus />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-600 font-medium px-3 py-1">Cancel</button>
                <button type="submit" disabled={editMutation.isPending || !editText.trim()}
                  className="text-sm font-medium px-3 py-1 bg-blue-600 text-white rounded-full disabled:opacity-50">Save</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-gray-900">@{author.name}</span>
                <span className="text-xs text-gray-500">&middot; {timeAgo(comment.created_at)}</span>
              </div>
              <p className="text-sm text-gray-800 mt-0.5">{commentBody}</p>

              {/* Action bar */}
              <div className="flex items-center gap-1 mt-1.5">
                <button onClick={handleLike} className="p-1.5 rounded-full hover:bg-gray-100">
                  <ThumbsUp className={`w-4 h-4 ${localLiked ? 'fill-[#F2284D] text-[#F2284D]' : 'text-gray-600'}`} />
                </button>
                {localLikes > 0 && <span className="text-xs text-gray-600 mr-1">{localLikes}</span>}

                <button onClick={handleDislike} className="p-1.5 rounded-full hover:bg-gray-100">
                  <ThumbsDown className={`w-4 h-4 ${localDisliked ? 'fill-gray-700 text-gray-700' : 'text-gray-600'}`} />
                </button>
                {localDislikes > 0 && <span className="text-xs text-gray-600 mr-1">{localDislikes}</span>}

                {canReply && (
                  <button onClick={() => setShowReplyInput(!showReplyInput)}
                    className="text-xs font-semibold text-gray-600 hover:text-gray-900 ml-2 px-3 py-1 rounded-full hover:bg-gray-100">
                    Reply
                  </button>
                )}

                {isOwn && (
                  <div className="relative ml-auto" ref={menuRef}>
                    <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-full hover:bg-gray-100">
                      <MoreHorizontal className="w-4 h-4 text-gray-500" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                        {canEdit(comment.created_at) && (
                          <button onClick={() => { setEditing(true); setEditText(commentBody); setShowMenu(false); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                        <button onClick={() => { handleDelete(); setShowMenu(false); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-50">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Reply input (post owner only) */}
          {showReplyInput && (
            <div className="mt-3 relative">
              <div className="flex items-center gap-2">
                <div className="relative" ref={emojiRef}>
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-1.5 rounded-full hover:bg-gray-100">
                    <Smile className="w-4 h-4 text-gray-500" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-10 left-0 z-20">
                      <Suspense fallback={<div className="w-[352px] h-[435px] bg-white rounded-lg shadow-lg flex items-center justify-center"><div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
                        <EmojiPicker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" perLine={9} maxFrequentRows={2} />
                      </Suspense>
                    </div>
                  )}
                </div>
                <form onSubmit={handleReply} className="flex-1">
                  <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Add a reply..." autoFocus
                    className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-sm text-gray-800 py-1 placeholder:text-gray-400" />
                </form>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => { setShowReplyInput(false); setReplyText(''); setShowEmojiPicker(false); }}
                  className="text-sm text-gray-600 font-medium px-3 py-1">Cancel</button>
                <button onClick={handleReply} disabled={!replyText.trim() || replyMutation.isPending}
                  className="text-sm font-medium px-3 py-1 bg-blue-600 text-white rounded-full disabled:opacity-50">Reply</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline reply */}
      {visibleReply && (
        <ReplyItem reply={visibleReply} postId={postId} postAuthorId={postAuthorId} myId={myId} myName={myName} myAvatar={myAvatar} />
      )}
    </div>
  );
};

// --- Main CommentSection ---
const CommentSection: React.FC<CommentSectionProps> = ({ postId, postAuthorId = '', commentsCount, alwaysExpanded = false, focusCommentId }) => {
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded || !!focusCommentId);
  const [commentText, setCommentText] = useState('');
  const [showButtons, setShowButtons] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [highlightId, setHighlightId] = useState<string | undefined>(focusCommentId);
  const scrolledRef = useRef(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useMyProfile();

  // Use "around" query when deep-linking to a specific comment, else normal paginated query
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

  // Close emoji picker on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    if (showEmojiPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  // Scroll to focused comment after comments load
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
    setShowButtons(false);
    setShowEmojiPicker(false);
  };

  const handleCancel = () => {
    setCommentText('');
    setShowButtons(false);
    setShowEmojiPicker(false);
    inputRef.current?.blur();
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    setCommentText(prev => prev + emoji.native);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  if (!isExpanded && !alwaysExpanded && !focusCommentId) {
    return (
      <div className="px-6 pb-4">
        {commentsCount > 0 && (
          <button onClick={() => setIsExpanded(true)}
            className="text-[13px] font-semibold text-gray-500 hover:text-gray-900">
            View all {commentsCount} comments
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 bg-white">
      {/* Comment input */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="relative" ref={emojiRef}>
            <button type="button" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowButtons(true); }}
              className="p-1.5 rounded-full hover:bg-gray-100">
              <Smile className="w-5 h-5 text-gray-500" />
            </button>
            {showEmojiPicker && (
              <div className="absolute top-10 left-0 z-20">
                <Suspense fallback={<div className="w-[352px] h-[435px] bg-white rounded-lg shadow-lg flex items-center justify-center"><div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
                  <EmojiPicker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" perLine={9} maxFrequentRows={2} />
                </Suspense>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onFocus={() => setShowButtons(true)}
              placeholder="Add a comment..."
              className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-sm text-gray-800 py-1.5 placeholder:text-gray-400"
            />
          </form>
        </div>
        {showButtons && (
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={handleCancel}
              className="text-sm text-gray-600 font-medium px-3 py-1.5">Cancel</button>
            <button onClick={handleSubmit} disabled={!commentText.trim() || addComment.isPending}
              className="text-sm font-medium px-4 py-1.5 bg-blue-600 text-white rounded-full disabled:opacity-50">Comment</button>
          </div>
        )}
      </div>

      {/* Comments list */}
      <div className="px-6 max-h-[400px] overflow-y-auto divide-y divide-gray-100">
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && comments && comments.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first!</p>
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
    </div>
  );
};

export default CommentSection;
