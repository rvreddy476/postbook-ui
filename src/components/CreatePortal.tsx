'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity as ActivityIcon,
  AlertCircle,
  BarChart3,
  BookOpen,
  ChevronDown,
  Globe,
  Hash,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Send,
  ShieldCheck,
  Smile,
  Type,
  Users,
  X,
} from 'lucide-react';

/**
 * Multi-colored flower-petal icon on a dark square — used as the
 * "Design background" trigger in the composer. Six overlapping
 * translucent circles ring a center disc; arranged so the colors
 * blend like the iOS Shortcuts icon the user referenced.
 */
const FlowerPaletteIcon: React.FC<{ size?: number; className?: string }> = ({ size = 22, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    className={className}
    aria-hidden="true"
  >
    <rect width="32" height="32" rx="9" fill="#0E0E10" />
    <g style={{ mixBlendMode: 'screen' }} transform="translate(16 16)">
      {/* 6 petals around a center, each rotated 60° apart */}
      <circle cx="0" cy="-6" r="6" fill="#FF4F8B" opacity="0.92" />
      <circle cx="5.2" cy="-3" r="6" fill="#FFB13E" opacity="0.92" />
      <circle cx="5.2" cy="3" r="6" fill="#FFE54B" opacity="0.92" />
      <circle cx="0" cy="6" r="6" fill="#4ED96B" opacity="0.92" />
      <circle cx="-5.2" cy="3" r="6" fill="#3AC7FF" opacity="0.92" />
      <circle cx="-5.2" cy="-3" r="6" fill="#A862FF" opacity="0.92" />
      {/* center highlight */}
      <circle cx="0" cy="0" r="2.4" fill="#FFFFFF" opacity="0.55" />
    </g>
  </svg>
);

import { useMyProfile } from '@/hooks/useEditProfile';
import { useCreatePost } from '@/hooks/useFeedPosts';
import { useCreateGroupPost } from '@/hooks/useGroups';
import { uploadMedia } from '@/lib/mediaUpload';
import { POST_CONTENT_TYPES } from '@/types/profile';

import PollEditor, { type PollState } from '@/components/studio/PollEditor';
import MoodActivityPicker from '@/components/studio/MoodActivityPicker';

interface CreatePortalProps {
  onClose: () => void;
  groupId?: string;
}

type PostVisibility = 'public' | 'followers' | 'trusted' | 'private';

// Rainbow palette, ROYGBIV-ordered so the picker can lay them out as
// a half-circle. No black/dark-near-black swatches by request — the
// `dark` flag still tells the textarea to flip text colour to white
// for the deeper hues (deep red, deep blue, indigo, deep green).
const BACKGROUNDS: { value: string | null; label: string; dark?: boolean }[] = [
  { value: null, label: 'No background' },
  { value: '#E63946', label: 'Red', dark: true },
  { value: '#F58F47', label: 'Orange' },
  { value: '#FFD23F', label: 'Yellow' },
  { value: '#4ED96B', label: 'Green' },
  { value: '#3AC7FF', label: 'Sky' },
  { value: '#2563EB', label: 'Blue', dark: true },
  { value: '#A862FF', label: 'Indigo', dark: true },
  { value: '#FF4F8B', label: 'Pink', dark: true },
];

const VIS_OPTIONS: { value: PostVisibility; label: string; Icon: typeof Globe }[] = [
  { value: 'public', label: 'Everyone', Icon: Globe },
  { value: 'followers', label: 'Followers', Icon: Users },
  { value: 'trusted', label: 'Trusted', Icon: ShieldCheck },
  { value: 'private', label: 'Only me', Icon: Lock },
];

const CreatePortal: React.FC<CreatePortalProps> = ({ onClose, groupId }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [showMood, setShowMood] = useState(false);
  const [moodTab, setMoodTab] = useState<'feeling' | 'activity'>('feeling');
  const [location, setLocation] = useState('');
  const [showLocation, setShowLocation] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [poll, setPoll] = useState<PollState>({ options: ['', ''], duration: '1d', allowMultiple: false });
  const [pollOptionErrors, setPollOptionErrors] = useState<Record<number, string>>({});
  const [pollQuestionError, setPollQuestionError] = useState<string | null>(null);
  // Hashtag chips — kept separate from the main text so we never inject raw "#" characters there.
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [showHashtagInput, setShowHashtagInput] = useState(false);
  const [hashtagDraft, setHashtagDraft] = useState('');
  const [background, setBackground] = useState<string | null>(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  /*
    Journal = a longer written entry with a heading. There is no journal
    content_type on the backend (POST_CONTENT_TYPES is post|poll|reel|video),
    so it posts as an ordinary post with the heading as the first line. That
    is a deliberate client-side framing, NOT a new kind of object — if it
    should be its own type, that is a backend change.
  */
  const [showJournal, setShowJournal] = useState(false);
  const [journalTitle, setJournalTitle] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useMyProfile();
  const createPost = useCreatePost();
  const createGroupPost = useCreateGroupPost();

  /**
   * One durable key per composer session.
   *
   * post-service requires a UUID Idempotency-Key on create and refuses the
   * request without one — the web sent none, so nothing could be posted at
   * all. It lives in a ref rather than being minted at each attempt because a
   * failed POST may in fact have committed before the response was lost: a
   * second attempt with the SAME key returns the post already created, while
   * a fresh key would publish it twice. Cleared after a successful post, so
   * reopening the composer is a new intent.
   */
  const createKeyRef = useRef<string>('');
  const nextCreateKey = () => {
    if (!createKeyRef.current) createKeyRef.current = crypto.randomUUID();
    return createKeyRef.current;
  };

  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=User';
  const displayName = profile?.display_name || 'User';
  const handle = profile?.username ? `@${profile.username}` : '@you';
  const firstName = displayName.split(' ')[0] || 'you';

  const bgSwatch = BACKGROUNDS.find((b) => b.value === background) ?? BACKGROUNDS[0];
  const onDark = !!bgSwatch.dark;
  const isTextOnly = files.length === 0 && !showPoll;
  const hasColorBg = background !== null && isTextOnly;

  const validPollOptions = poll.options.filter((o) => o.trim()).length >= 2;
  const canPost = Boolean(text.trim() || journalTitle.trim() || files.length > 0 || (showPoll && validPollOptions));
  const charCount = text.length;
  const maxChars = 2000;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [text]);

  useEffect(() => {
    const t = window.setTimeout(() => textareaRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // Drop background when media or poll is added — colored backgrounds are
  // text-only by design.
  useEffect(() => {
    if (files.length > 0 || showPoll) {
      setBackground(null);
      setShowBackgroundPicker(false);
    }
  }, [files.length, showPoll]);

  // Normalize: strip leading #, trim, drop spaces/punct that aren't word chars,
  // lowercase. "  #Design ! " → "design".
  const normalizeTag = (raw: string): string =>
    raw
      .trim()
      .replace(/^#+/, '')
      .replace(/[^\p{L}\p{N}_]/gu, '')
      .toLowerCase();

  const commitHashtagDraft = useCallback(() => {
    const parts = hashtagDraft.split(/[\s,]+/).map(normalizeTag).filter(Boolean);
    if (parts.length === 0) {
      setHashtagDraft('');
      return;
    }
    setHashtags((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const t of parts) {
        if (!seen.has(t)) {
          next.push(t);
          seen.add(t);
        }
      }
      return next.slice(0, 30);
    });
    setHashtagDraft('');
  }, [hashtagDraft]);

  const removeHashtag = (tag: string) =>
    setHashtags((prev) => prev.filter((t) => t !== tag));

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = useCallback(async () => {
    if (!canPost || isSubmitting) return;

    // Frontend poll validation — never let an invalid poll hit the backend.
    if (showPoll) {
      const optionErrors: Record<number, string> = {};
      const trimmedOptions = poll.options.map((o) => o.trim());
      const seen = new Map<string, number>();
      trimmedOptions.forEach((o, idx) => {
        if (!o) {
          optionErrors[idx] = 'Please enter this option.';
        } else {
          const lower = o.toLowerCase();
          if (seen.has(lower)) {
            optionErrors[idx] = 'Duplicate option — please change or remove.';
            optionErrors[seen.get(lower)!] = 'Duplicate option — please change or remove.';
          } else {
            seen.set(lower, idx);
          }
        }
      });
      const validCount = trimmedOptions.filter((o) => o && Object.keys(optionErrors).every((k) => Number(k) !== trimmedOptions.indexOf(o))).length;
      const hasQuestion = text.trim().length > 0;

      const issues: string[] = [];
      if (!hasQuestion) {
        setPollQuestionError('Please enter poll question.');
        issues.push('question');
      } else {
        setPollQuestionError(null);
      }
      if (validCount < 2) issues.push('options');

      if (issues.length > 0 || Object.keys(optionErrors).length > 0) {
        setPollOptionErrors(optionErrors);
        const msg =
          issues.length === 2
            ? 'Please provide the poll question and at least two poll options.'
            : !hasQuestion
              ? 'Please enter poll question.'
              : validCount < 2
                ? 'Please provide at least two poll options.'
                : 'Please fix the highlighted poll fields.';
        setError(msg);
        return;
      }
      setPollOptionErrors({});
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let mediaIds: string[] | undefined;
      if (files.length > 0) {
        const uploaded = await Promise.all(
          files.map((file) => {
            const fileType: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
            return uploadMedia(file, fileType, 'general');
          }),
        );
        mediaIds = uploaded;
      }

      let contentType: string = POST_CONTENT_TYPES.POST;
      if (showPoll) {
        contentType = POST_CONTENT_TYPES.POLL;
      } else if (files.length > 0 && files.some((f) => f.type.startsWith('video'))) {
        contentType = POST_CONTENT_TYPES.VIDEO;
      }

      let feeling: string | null = null;
      let activity: string | null = null;
      let activityDetail: string | null = null;

      if (mood) {
        const activityLabels = ['Listening to', 'Watching', 'Playing', 'Reading', 'Travelling to', 'Eating at', 'Working on', 'Creating'];
        const match = activityLabels.find((l) => mood.includes(l));
        if (match) {
          activity = match;
          activityDetail = mood.split(match)[1]?.trim() || null;
        } else {
          feeling = mood;
        }
      }

      const durationMap: Record<string, number> = { '1d': 24, '3d': 72, '7d': 168 };
      const pollPayload = showPoll
        ? {
            question: text.trim() || 'Untitled Poll',
            options: poll.options.filter((o) => o.trim()),
            allows_multiple: poll.allowMultiple,
            duration_hours: durationMap[poll.duration] || 24,
          }
        : null;

      const richText = hasColorBg && background
        ? { background, text_color: onDark ? '#ffffff' : '#111111' }
        : null;

      // Merge any pending hashtag draft so users who type then click POST
      // without pressing Enter don't lose their tag.
      const finalHashtags = (() => {
        if (!hashtagDraft.trim()) return hashtags;
        const draftParts = hashtagDraft.split(/[\s,]+/).map(normalizeTag).filter(Boolean);
        const out = [...hashtags];
        const seen = new Set(out);
        for (const t of draftParts) {
          if (!seen.has(t)) {
            out.push(t);
            seen.add(t);
          }
        }
        return out.slice(0, 30);
      })();

      // Backend extracts hashtags from the post body via regex, so we
      // append the chip-entered tags to the wire text. The user's typing
      // surface stays free of stray "#" characters; only the persisted
      // body (and the rendered post) carries them.
      const tagSuffix = finalHashtags.length > 0
        ? ' ' + finalHashtags.map((t) => `#${t}`).join(' ')
        : '';
      // A journal title becomes the first line of the body. There is no
      // journal content_type on the wire, so this is presentation, not a new
      // object — see the note beside the showJournal state.
      const titlePrefix = showJournal && journalTitle.trim()
        ? journalTitle.trim() + '\n\n'
        : '';
      const wireText = (titlePrefix + text.trim() + tagSuffix).trim();

      const payload = {
        text: wireText,
        visibility,
        content_type: contentType,
        media_ids: mediaIds,
        feeling,
        activity,
        activity_detail: activityDetail,
        location: location.trim() || null,
        poll: pollPayload,
        rich_text: richText,
        hashtags: finalHashtags.length > 0 ? finalHashtags : undefined,
        idempotencyKey: nextCreateKey(),
      };

      if (groupId) {
        await createGroupPost.mutateAsync({ groupId, ...payload });
      } else {
        await createPost.mutateAsync(payload);
      }
      // The intent is done; the next composer session gets its own key.
      createKeyRef.current = '';
      onClose();
    } catch (err: unknown) {
      let message = 'Failed to create post. Try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        if (axiosErr.response?.data?.error?.message) message = axiosErr.response.data.error.message;
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [background, canPost, createGroupPost, createPost, files, groupId, hashtagDraft, hashtags, hasColorBg, isSubmitting, location, mood, onClose, onDark, poll, showPoll, text, visibility]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSubmit]);

  const visOption = VIS_OPTIONS.find((v) => v.value === visibility) ?? VIS_OPTIONS[0];
  const VisIcon = visOption.Icon;

  /**
   * What this composer is about to publish, in words.
   *
   * The controls said what they DO — Photo, Poll, Feeling — but nothing said
   * what you had ended up with. With a photo attached, a feeling set and a
   * background chosen, the only way to know which of those actually shapes
   * the post was to press Post and look at the feed. This is the one line
   * that answers it, and it sits directly above the button that acts on it.
   */
  const summary = useMemo(() => {
    const hasVideo = files.some((f) => f.type.startsWith('video'));
    const Icon = showPoll ? BarChart3
      : files.length > 0 ? ImagePlus
      : showJournal ? BookOpen
      : Type;
    const kind = showPoll ? 'Poll'
      : files.length > 0 ? (hasVideo ? 'Video post' : 'Photo post')
      : showJournal ? 'Journal entry'
      : hasColorBg ? 'Text post on a background'
      : 'Text post';

    const detail: string[] = [];
    if (files.length > 0) {
      detail.push(`${files.length} ${files.length === 1 ? 'file' : 'files'}`);
    }
    if (showPoll) {
      const filled = poll.options.filter((o) => o.trim()).length;
      if (filled > 0) detail.push(`${filled} ${filled === 1 ? 'option' : 'options'}`);
    }
    if (mood) detail.push(mood);
    if (location.trim()) detail.push(location.trim());
    const tagCount = hashtags.length + (hashtagDraft.trim() ? 1 : 0);
    if (tagCount > 0) detail.push(`${tagCount} ${tagCount === 1 ? 'tag' : 'tags'}`);

    return { Icon, kind, detail: detail.join(' · ') };
  }, [files, hasColorBg, hashtagDraft, hashtags, location, mood, poll, showJournal, showPoll]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="mx-3 w-full max-w-[720px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-[28px] bg-brand-card border border-brand-divider shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-5">
          <div>
            {/* "CREATE POST" was typed in capitals rather than styled that
                way, which is why the capitalisation sweep could not reach it. */}
            <div className="text-xl font-semibold -tracking-[0.018em] text-brand-text">
              Create post
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary border border-brand-divider text-brand-text transition-transform hover:scale-105 active:scale-95"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* User row */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-3">
            <img
              src={avatarSrc}
              alt=""
              className="h-11 w-11 rounded-full border-2 border-brand-secondary object-cover shadow-xs"
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] font-medium text-brand-text">{displayName}</div>
              <div className="mt-0.5 text-[11px] text-brand-text/60">{handle}</div>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVisMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-brand-secondary border border-brand-divider px-3.5 py-2 text-[11px] font-medium tracking-wider text-brand-text shadow-xs transition hover:bg-brand-secondary/80"
            >
              <VisIcon className="h-3.5 w-3.5 text-primary-ink" />
              {visOption.label}
              <ChevronDown className="h-3 w-3 text-brand-text/60" />
            </button>
            <AnimatePresence>
              {showVisMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-brand-divider bg-brand-card shadow-xl"
                >
                  {VIS_OPTIONS.map((opt) => {
                    const Icon = opt.Icon;
                    const active = opt.value === visibility;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setVisibility(opt.value); setShowVisMenu(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium transition-colors ${
                          active ? 'bg-brand-secondary text-primary-ink' : 'text-brand-text hover:bg-brand-secondary'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Scrollable middle */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Mood / Location chips */}
          {(mood || location) && (
            <div className="flex flex-wrap gap-1.5 px-6 pt-3">
              {mood && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-secondary border border-brand-divider px-2.5 py-1 text-[11px] font-medium text-warning shadow-xs">
                  <Smile className="h-3 w-3" />
                  {mood}
                  <button onClick={() => setMood(null)} className="text-brand-text/40 hover:text-brand-text">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {location && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-secondary border border-brand-divider px-2.5 py-1 text-[11px] font-medium text-success shadow-xs">
                  <MapPin className="h-3 w-3" />
                  {location}
                  <button
                    onClick={() => { setLocation(''); setShowLocation(false); }}
                    className="text-brand-text/40 hover:text-brand-text"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Composition card — hidden in poll mode since the poll editor
              has its own dedicated Question input. */}
          {!showPoll && (
          <div className="px-6 pt-4">
            <div
              className={`rounded-[20px] p-5 transition-colors duration-300 ${
                hasColorBg ? '' : 'bg-brand-secondary border border-brand-divider text-brand-text'
              }`}
              style={hasColorBg ? {
                backgroundColor: background!,
                color: onDark ? '#ffffff' : '#111',
              } : undefined}
            >
              {showJournal && (
                <input
                  value={journalTitle}
                  onChange={(e) => setJournalTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={120}
                  className={`mb-3 w-full border-b bg-transparent pb-2 text-lg font-semibold -tracking-[0.018em] outline-hidden ${
                    hasColorBg ? 'border-white/25 placeholder:text-current/50' : 'border-brand-divider text-brand-text placeholder:text-brand-text/35'
                  }`}
                />
              )}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (pollQuestionError) setPollQuestionError(null);
                }}
                placeholder={showPoll ? 'Ask a question…' : `What's on your mind, ${firstName}?`}
                rows={3}
                maxLength={maxChars}
                className={`w-full resize-none bg-transparent outline-hidden ${
                  hasColorBg
                    ? `text-center text-[18px] font-semibold leading-relaxed ${onDark ? 'text-white placeholder:text-white/60' : 'text-neutral-900 placeholder:text-neutral-900/60'}`
                    : 'text-[17px] leading-normal text-brand-text placeholder:text-brand-text/45'
                } ${pollQuestionError ? 'ring-1 ring-rose-500 rounded-sm' : ''}`}
                style={hasColorBg && onDark ? { color: '#ffffff' } : undefined}
              />
              {pollQuestionError && (
                <div className="mt-1 text-[11px] font-medium text-rose-600">{pollQuestionError}</div>
              )}

              {/* Media previews */}
              {previews.length > 0 && (
                <div
                  className={`mt-3 grid gap-1.5 ${
                    previews.length === 1 ? 'grid-cols-2' : previews.length <= 4 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}
                >
                  {previews.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square overflow-hidden rounded-lg bg-black/5"
                    >
                      {files[idx]?.type.startsWith('video') ? (
                        <video src={url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      )}
                      <button
                        onClick={() => removeFile(idx)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-brand-divider transition hover:border-[#2563EB] hover:bg-brand-secondary"
                  >
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Poll editor */}
          {showPoll && (
            <div className="px-6 pt-3">
              <div className="rounded-[18px] bg-brand-secondary border border-brand-divider px-4 py-3">
                <PollEditor
                  poll={poll}
                  onChange={(next) => {
                    setPoll(next);
                    if (Object.keys(pollOptionErrors).length > 0) setPollOptionErrors({});
                  }}
                  accentColor="#2563EB"
                  isDarkMode={isDark}
                  optionErrors={pollOptionErrors}
                  question={text}
                  onQuestionChange={(next) => {
                    setText(next);
                    if (pollQuestionError) setPollQuestionError(null);
                  }}
                  questionError={pollQuestionError}
                />
              </div>
            </div>
          )}

          {/* Mood picker */}
          {showMood && (
            <div className="px-6 pt-3">
              <div className="rounded-[18px] bg-brand-secondary border border-brand-divider px-3 py-3">
                <MoodActivityPicker
                  key={moodTab}
                  initialTab={moodTab}
                  accentColor="rgb(var(--brand-ink))"
                  isDarkMode={isDark}
                  onSelect={(m) => { setMood(m); setShowMood(false); }}
                  onClose={() => setShowMood(false)}
                />
              </div>
            </div>
          )}

          {/* Location input */}
          {showLocation && (
            <div className="px-6 pt-3">
              <div className="flex items-center gap-2 rounded-[18px] bg-brand-secondary border border-brand-divider px-4 py-3">
                <MapPin className="h-3.5 w-3.5 text-success" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where are you?"
                  className="flex-1 bg-transparent text-[12px] text-brand-text placeholder:text-brand-text/45 outline-hidden"
                  autoFocus
                />
                <button onClick={() => setShowLocation(false)} className="text-brand-text/40 hover:text-brand-text">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Hashtag input — chips, never injects raw `#` into the post text. */}
          {showHashtagInput && (
            <div className="px-6 pt-3">
              <div className="rounded-[18px] bg-brand-secondary border border-brand-divider px-4 py-3">
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-primary-ink" />
                  <input
                     value={hashtagDraft}
                     onChange={(e) => setHashtagDraft(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                         if (hashtagDraft.trim()) {
                           e.preventDefault();
                           commitHashtagDraft();
                         }
                       } else if (e.key === 'Backspace' && !hashtagDraft && hashtags.length > 0) {
                         setHashtags((prev) => prev.slice(0, -1));
                       }
                     }}
                     onBlur={() => {
                       if (hashtagDraft.trim()) commitHashtagDraft();
                     }}
                     placeholder="Enter hashtags and press Enter"
                     className="flex-1 bg-transparent text-[12px] text-brand-text placeholder:text-brand-text/45 outline-hidden"
                     autoFocus
                   />
                  <button
                    onClick={() => setShowHashtagInput(false)}
                    className="text-brand-text/40 hover:text-brand-text"
                    aria-label="Close hashtag input"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {hashtags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-card border border-brand-divider px-2.5 py-1 text-[11px] font-medium text-primary-ink"
                      >
                        #{tag}
                        <button
                          onClick={() => removeHashtag(tag)}
                          className="text-primary-ink/60 hover:text-primary-ink"
                          aria-label={`Remove #${tag}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/*
          What you are about to publish, and who will see it. The error sits
          here too rather than up in the body: it explains why the button
          beneath it did nothing, so it belongs beside the button.
        */}
        <div className="shrink-0 px-6 pt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-brand-text/60">
            <summary.Icon className="h-4 w-4 shrink-0 text-brand-text/45" strokeWidth={1.75} />
            <span className="font-semibold text-brand-text">{summary.kind}</span>
            {summary.detail && <span>· {summary.detail}</span>}
            <span className="inline-flex items-center gap-1">
              · seen by <VisIcon className="h-3 w-3" /> {visOption.label}
            </span>
          </div>
          {error && (
            <div
              role="alert"
              className="mt-2.5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12px] text-danger"
            >
              <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-3 pb-4">
          {/* What you can add, NAMED.
              This was six icons in six different colours with no labels, so
              the composer's abilities were guessable at best — a poll and a
              feeling looked like decoration. Colour now carries state (added
              or not) instead of identity, and every control says what it is. */}
          {/* This row used to sit in a filled, bordered slab, which made a set
              of optional extras the heaviest block in the dialog. The pills
              carry their own state; the container is just spacing. */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 10}
              title="Add a photo"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-30 ${files.length > 0 ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
              Photo
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPoll((v) => !v);
                if (showPoll) setPoll({ options: ['', ''], duration: '1d', allowMultiple: false });
              }}
              title="Ask a question with options"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${showPoll ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
              Poll
            </button>
            <button
              type="button"
              onClick={() => setShowJournal((v) => !v)}
              title="Write something longer"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${showJournal ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.75} />
              Journal
            </button>
            {/* Feeling and Activity share one picker with two tabs; each
                button opens its own tab, and pressing the open one closes it. */}
            <button
              type="button"
              onClick={() => {
                if (showMood && moodTab === 'feeling') { setShowMood(false); return; }
                setMoodTab('feeling');
                setShowMood(true);
              }}
              title="How you are feeling"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${(showMood && moodTab === 'feeling') ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <Smile className="h-4 w-4" strokeWidth={1.75} />
              Feeling
            </button>
            <button
              type="button"
              onClick={() => {
                if (showMood && moodTab === 'activity') { setShowMood(false); return; }
                setMoodTab('activity');
                setShowMood(true);
              }}
              title="What you are doing"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${(showMood && moodTab === 'activity') ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <ActivityIcon className="h-4 w-4" strokeWidth={1.75} />
              Activity
            </button>
            <button
              type="button"
              onClick={() => setShowLocation((v) => !v)}
              title="Add a place"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${showLocation || location ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <MapPin className="h-4 w-4" strokeWidth={1.75} />
              Place
            </button>
            <button
              type="button"
              onClick={() => setShowHashtagInput((v) => !v)}
              title="Add a hashtag"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${showHashtagInput || hashtags.length > 0 ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <Hash className="h-4 w-4" strokeWidth={1.75} />
              Tag
            </button>
            {/* Design: paints the textarea card background. Disabled when
                media or a poll is present (color backgrounds are text-only
                by design). */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBackgroundPicker((v) => !v)}
                aria-label="Design"
                title="Design background"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-105 ${
                  showBackgroundPicker || background ? 'ring-2 ring-offset-1 ring-primary' : ''
                }`}
              >
                <FlowerPaletteIcon size={26} />
              </button>
              <AnimatePresence>
                {showBackgroundPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 z-30 mb-3 rounded-2xl border border-brand-divider bg-brand-card px-5 pb-4 pt-3 shadow-xl"
                  >
                    {!isTextOnly && (
                      <div className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                        Backgrounds work only on text-only posts. Remove
                        any media or poll first.
                      </div>
                    )}
                    <div className="mb-2 flex items-center justify-between gap-6">
                      <div className="text-[10px] font-medium tracking-[0.15em] text-brand-text/60">
                        Background
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBackground(null);
                          setShowBackgroundPicker(false);
                        }}
                        className="text-[10px] font-medium tracking-widest text-primary-ink hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    {/* Rainbow half-arc: swatches arrayed across the top
                        of a circle so they trace a smile-shaped arc. The
                        arc's radius / arc-degrees feel right for ~8 colours;
                        the null/no-bg swatch sits centred underneath the
                        peak as the "neutral" pick. */}
                    {(() => {
                      const swatches = BACKGROUNDS.filter((s) => s.value !== null);
                      const noneSwatch = BACKGROUNDS.find((s) => s.value === null)!;
                      const radius = 80;
                      const arcSpan = 160; // degrees
                      const start = 180 + (180 - arcSpan) / 2; // left of arc
                      const arcWidth = radius * 2 + 28;
                      const arcHeight = radius + 26;
                      return (
                        <div
                          className="relative mx-auto"
                          style={{ width: arcWidth, height: arcHeight }}
                        >
                          {swatches.map((swatch, idx) => {
                            const t = swatches.length === 1 ? 0.5 : idx / (swatches.length - 1);
                            const angle = start + t * arcSpan;
                            const rad = (angle * Math.PI) / 180;
                            const cx = arcWidth / 2 + radius * Math.cos(rad);
                            const cy = arcHeight + radius * Math.sin(rad);
                            const selected = swatch.value === background;
                            return (
                              <button
                                key={swatch.label}
                                type="button"
                                aria-label={swatch.label}
                                onClick={() => {
                                  setBackground(swatch.value);
                                  setShowBackgroundPicker(false);
                                }}
                                className="absolute h-7 w-7 cursor-pointer rounded-full border-2 border-white shadow-xs transition-transform hover:scale-125"
                                style={{
                                  left: cx - 14,
                                  top: cy - 14,
                                  background: swatch.value!,
                                  outline: selected ? '2px solid #2563EB' : 'none',
                                  outlineOffset: selected ? '1px' : 0,
                                }}
                              />
                            );
                          })}
                          {/* No-background (transparent) swatch in the center, below the arc peak */}
                          <button
                            type="button"
                            aria-label={noneSwatch.label}
                            onClick={() => {
                               setBackground(null);
                               setShowBackgroundPicker(false);
                            }}
                            className="absolute h-7 w-7 cursor-pointer rounded-full border-2 border-white shadow-xs transition-transform hover:scale-125"
                            style={{
                              left: arcWidth / 2 - 14,
                              top: arcHeight - 8,
                              background:
                                'repeating-conic-gradient(var(--brand-divider) 0% 25%, transparent 0% 50%) 50% / 8px 8px',
                              outline: background === null ? '2px solid #2563EB' : 'none',
                              outlineOffset: background === null ? '1px' : 0,
                            }}
                          />
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canPost || isSubmitting}
            // Sentence case at a normal size. It was ALL CAPS with 0.15em
            // tracking on a 22px badge, which made the one button you press
            // every time the loudest object in the dialog.
            className="flex shrink-0 items-center gap-2 rounded-full bg-primary-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-primary-hover disabled:opacity-40"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
            {isSubmitting ? 'Posting…' : 'Post'}
          </button>
        </div>

        {/* Footer status bar. The tiny all-caps widest-tracked text here was
            the hardest thing in the dialog to read, for the least important
            information in it. */}
        <div className="flex shrink-0 items-center justify-between bg-brand-secondary border-t border-brand-divider px-6 py-3 text-[12px] text-brand-text/60">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            {isSubmitting ? 'Publishing…' : 'Auto-saved as draft'}
          </div>
          <div className={charCount > maxChars * 0.9 ? 'font-semibold text-brand-text' : ''}>
            {charCount.toLocaleString()} / {maxChars.toLocaleString()}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>
    </motion.div>
  );
};

export default CreatePortal;
