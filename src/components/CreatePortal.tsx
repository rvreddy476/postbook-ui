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
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  AlignCenter,
  AlignCenterVertical,
  AlignLeft,
  AlignStartVertical,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
  Smile,
  Type,
  Users,
  Video as VideoIcon,
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
import { useGlobalToast } from '@/contexts/ToastContext';
import { useCreatePost } from '@/hooks/useFeedPosts';
import { useCreateGroupPost } from '@/hooks/useGroups';
import { uploadMedia } from '@/lib/mediaUpload';
import { POST_CONTENT_TYPES } from '@/types/profile';

import PollEditor, { type PollState } from '@/components/studio/PollEditor';
import RichTextEditor from '@/components/studio/RichTextEditor';
import type { PostRichText, RichNode } from '@/components/studio/postStyle';
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
  // Feeling, Activity and Background live behind the More tile rather than
  // each taking a slot of their own in a seven-tile row.
  const [showMore, setShowMore] = useState(false);

  // Journal's document, kept beside the plain text the rest of the product reads.
  const [richDoc, setRichDoc] = useState<RichNode | null>(null);
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
  const toast = useGlobalToast();
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
  // Templates were removed at the founder's request (23 Sep): the strip, the
  // alignment and size controls, the colour pickers and the uploaded
  // background image all went with them. The plain background swatches behind
  // "More" are what remain, and they are what hasColorBg has always meant.
  const isStyledCard = hasColorBg;
  const styleOnDark = hasColorBg && onDark;

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

  // Leaving a media post drops what it had collected, so an attachment cannot
  // ride along invisibly on a poll or a journal entry.
  const clearFiles = () => setFiles([]);

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
      // Kept beside the ids: the create response carries no media, so this is
      // what lets the card render its picture before fan-out hydrates it.
      let mediaWithKinds: { media_id: string; kind: string }[] | undefined;
      if (files.length > 0) {
        const uploaded = await Promise.all(
          files.map(async (file) => {
            const fileType: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
            return { media_id: await uploadMedia(file, fileType, 'general'), kind: fileType };
          }),
        );
        mediaWithKinds = uploaded;
        mediaIds = uploaded.map((m) => m.media_id);
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

      /*
        How the post looks, and its rich body, in one JSON object.
        post-service stores rich_text as arbitrary JSON and hands it back on
        read, so both survive the round trip with no backend change.

        Null when there is nothing to say: an ordinary text post should not
        carry a style object at all.
      */
      const richText: PostRichText | null = (() => {
        const styled = hasColorBg && background;
        if (!styled && !richDoc) return null;
        const value: PostRichText = {};
        if (styled) {
          value.background = background;
          value.text_color = onDark ? '#ffffff' : '#111111';
        }
        if (richDoc) {
          value.format = 'tiptap';
          value.doc = richDoc;
          // The heading is typed outside the editor, so the document does not
          // contain it. Carried here, it is what the card draws above the body.
          const heading = journalTitle.trim();
          if (showJournal && heading) value.title = heading;
        }
        return value;
      })();

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
        media: mediaWithKinds,
      };

      if (groupId) {
        await createGroupPost.mutateAsync({ groupId, ...payload });
      } else {
        await createPost.mutateAsync(payload);
      }
      // The intent is done; the next composer session gets its own key.
      createKeyRef.current = '';
      // Says the write landed even when the reader has scrolled away from the
      // top of the feed, where the new card is.
      toast({ type: 'success', title: 'Posted' });
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

  /*
    The tiles, and the modes behind them.

    Poll and Journal reshape the body, so they cannot both be on: picking one
    clears the other. Photo and Video open the same picker with a different
    `accept`, because the wire carries one media list either way — the split
    exists so "add a video" is something you can find, rather than something
    you discover by opening the photo picker.

    Each tile's colour is a token from src/ui/theme.css. Nothing here is a hex.
  */
  const openPicker = (accept: string) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };

  /*
    One kind of post at a time.

    Photo, Video, Poll and Journal are the four shapes a post can take, and
    they were only half exclusive: Poll and Journal cleared each other, but
    Photo did not clear Journal. So pressing the image icon while writing an
    entry attached a media grid UNDER the editor — two different bodies in one
    post, which is not a thing the wire can express and not what anyone meant
    by it. Journal now takes its pictures inside the editor, where they belong.

    Switching away from a mode clears what that mode collected, so a half-built
    poll or a stray attachment cannot ride along invisibly on a post of another
    kind.
  */
  const chooseMode = (mode: 'photo' | 'video' | 'poll' | 'journal') => {
    const leavingJournal = () => { setShowJournal(false); setRichDoc(null); setJournalTitle(''); };
    const leavingPoll = () => { setShowPoll(false); setPoll({ options: ['', ''], duration: '1d', allowMultiple: false }); setPollOptionErrors({}); setPollQuestionError(null); };

    if (mode === 'photo' || mode === 'video') {
      if (showJournal) leavingJournal();
      if (showPoll) leavingPoll();
      openPicker(mode === 'photo' ? 'image/*' : 'video/*');
      return;
    }

    if (mode === 'poll') {
      if (showPoll) { leavingPoll(); return; }
      if (showJournal) leavingJournal();
      clearFiles();
      setShowPoll(true);
      return;
    }

    if (showJournal) { leavingJournal(); return; }
    if (showPoll) leavingPoll();
    clearFiles();
    setShowJournal(true);
  };

  const hasVideoFile = files.some((f) => f.type.startsWith('video'));
  const tiles = [
    {
      key: 'photo', fg: 'text-tile-photo', label: 'Photo', Icon: ImageIcon, title: 'Add photos',
      active: files.length > 0 && !hasVideoFile,
      disabled: files.length >= 10,
      onClick: () => chooseMode('photo'),
    },
    {
      key: 'video', fg: 'text-tile-video', label: 'Video', Icon: VideoIcon, title: 'Add a video',
      active: hasVideoFile,
      disabled: files.length >= 10,
      onClick: () => chooseMode('video'),
    },
    {
      key: 'poll', fg: 'text-tile-poll', label: 'Poll', Icon: BarChart3, title: 'Ask a question with options',
      active: showPoll, disabled: false,
      onClick: () => chooseMode('poll'),
    },
    {
      key: 'journal', fg: 'text-tile-journal', label: 'Journal', Icon: BookOpen, title: 'Write something longer, with a title',
      active: showJournal, disabled: false,
      onClick: () => chooseMode('journal'),
    },
    {
      key: 'place', fg: 'text-tile-place', label: 'Place', Icon: MapPin, title: 'Add a place',
      active: showLocation || Boolean(location.trim()), disabled: false,
      onClick: () => setShowLocation((v) => !v),
    },
    {
      key: 'tag', fg: 'text-tile-tag', label: 'Tag', Icon: Hash, title: 'Add hashtags',
      active: showHashtagInput || hashtags.length > 0, disabled: false,
      onClick: () => setShowHashtagInput((v) => !v),
    },
    {
      key: 'more', fg: 'text-tile-more', label: 'More', Icon: MoreHorizontal, title: 'Feeling, activity and background',
      active: showMore || Boolean(mood) || Boolean(background), disabled: false,
      onClick: () => setShowMore((v) => !v),
    },
  ];

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
        {/*
          One header instead of two rows. The title sat alone above a separate
          identity row, so the dialog opened with two competing headers and the
          avatar was a third block. Avatar, title and who you are posting as now
          read as one line, with the two controls that act on the whole post -
          audience and close - grouped on the right.
        */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={avatarSrc}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full border border-brand-divider object-cover"
            />
            <div className="min-w-0 leading-tight">
              <div className="text-[19px] font-semibold -tracking-[0.018em] text-brand-text">
                Create post
              </div>
              {/* The reference says "Share your story" here. Naming the
                  account is worth more: it is the one fact you cannot get
                  back if you post from the wrong one. */}
              <div className="mt-0.5 truncate text-[12px] text-brand-text/60">
                Posting as {displayName} · {handle}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary border border-brand-divider text-brand-text transition-colors hover:bg-brand-divider/40"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
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
            {/*
              The writing card IS the preview. Template, alignment, vertical
              placement, scale, colour and an uploaded background all apply
              here exactly as PostCard will apply them once posted, so what
              you compose is what appears in the feed.
            */}
            <div
              className={`rounded-[20px] transition-colors duration-300 ${
                showJournal
                  ? ''
                  : isStyledCard
                    ? 'p-5'
                    : 'border border-brand-divider bg-brand-secondary p-5 text-brand-text'
              }`}
              style={isStyledCard && !showJournal ? {
                backgroundColor: background!,
                color: onDark ? '#ffffff' : '#111',
              } : undefined}
            >
              <div>
              {showJournal && (
                <input
                  value={journalTitle}
                  onChange={(e) => setJournalTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={120}
                  className="mb-3 w-full border-b border-brand-divider bg-transparent pb-2 text-lg font-semibold -tracking-[0.018em] text-brand-text outline-hidden placeholder:text-brand-text/35"
                />
              )}

              {/*
                Journal is a real editor, not a bigger textarea. It emits the
                ProseMirror document, which is what gets stored in rich_text
                and what the feed renders back through a whitelist.
              */}
              {showJournal ? (
                <RichTextEditor
                  onError={setError}
                  placeholder="Start writing…"
                  onChange={({ doc, text: plain }) => {
                    setRichDoc(doc);
                    setText(plain);
                  }}
                />
              ) : (
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
              )}
              {pollQuestionError && (
                <div className="mt-1 text-[11px] font-medium text-danger">{pollQuestionError}</div>
              )}

              {/* Count belongs with the words it counts. */}
              <div
                className={`mt-2 text-right text-[11px] tabular-nums ${
                  charCount > maxChars * 0.9 ? 'font-semibold text-danger' : 'text-brand-text/40'
                } ${hasColorBg ? 'text-current/60' : ''}`}
              >
                {charCount.toLocaleString()} / {maxChars.toLocaleString()}
              </div>

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
          The error sits down here rather than up in the body: it explains why
          the button below it did nothing, so it belongs beside that button.
        */}
        <div className="shrink-0 px-6 pt-3">
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

        {/*
          What you can add, as small plain icons.

          These were large tiles in seven colours, each with a label. The
          founder's read was right: a row of coloured squares outweighed the
          writing surface, which is the thing the dialog is for. They are now
          the same weight as the editor's own toolbar — one size, one colour,
          state shown by a tint rather than by a hue of its own — and each
          still names itself on hover and to a screen reader.
        */}
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 px-5 pt-3">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={tile.onClick}
              disabled={tile.disabled}
              aria-pressed={tile.active}
              aria-label={tile.label}
              title={tile.title}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-25 ${
                tile.active ? 'bg-brand-text/[0.08]' : 'hover:bg-brand-text/[0.06]'
              }`}
            >
              {/* Each action keeps its own colour; the tint behind it is what
                  shows state, so colour never has to mean two things. */}
              <tile.Icon className={`h-[18px] w-[18px] ${tile.fg}`} strokeWidth={1.75} />
            </button>
          ))}
        </div>

        {/* More: feeling, activity and background. */}
        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
              className="shrink-0 overflow-hidden px-6"
            >
              <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-2xl bg-brand-secondary p-2">
                <button
                  type="button"
                  onClick={() => {
                    if (showMood && moodTab === 'feeling') { setShowMood(false); return; }
                    setMoodTab('feeling');
                    setShowMood(true);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${(showMood && moodTab === 'feeling') ? 'bg-brand-card text-primary-ink' : 'text-brand-text/70 hover:bg-brand-card'}`}
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
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${(showMood && moodTab === 'activity') ? 'bg-brand-card text-primary-ink' : 'text-brand-text/70 hover:bg-brand-card'}`}
                >
                  <ActivityIcon className="h-4 w-4" strokeWidth={1.75} />
                  Activity
                </button>
                <button
                  type="button"
                  onClick={() => setShowBackgroundPicker((v) => !v)}
                  disabled={!isTextOnly}
                  title={isTextOnly ? 'Colour the card behind your words' : 'Backgrounds work only on text-only posts'}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-35 ${(showBackgroundPicker || background) ? 'bg-brand-card text-primary-ink' : 'text-brand-text/70 hover:bg-brand-card'}`}
                >
                  <FlowerPaletteIcon size={16} />
                  Background
                </button>
                {background && (
                  <button
                    type="button"
                    onClick={() => setBackground(null)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-brand-text/60 hover:text-brand-text"
                  >
                    Clear background
                  </button>
                )}
              </div>
              {showBackgroundPicker && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-brand-secondary p-3">
                  {BACKGROUNDS.map((swatch) => (
                    <button
                      key={swatch.label}
                      type="button"
                      aria-label={swatch.label}
                      title={swatch.label}
                      onClick={() => setBackground(swatch.value)}
                      className="h-7 w-7 rounded-full border border-brand-divider transition-transform hover:scale-110"
                      style={{
                        background:
                          swatch.value ??
                          'repeating-conic-gradient(var(--brand-divider) 0% 25%, transparent 0% 50%) 50% / 8px 8px',
                        outline: swatch.value === background ? '2px solid rgb(var(--brand-ink))' : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/*
          The summary line ("Text post on a background · seen by Everyone")
          was removed at the founder's request. The audience is already named
          in the header control that sets it, and the tiles above show what is
          attached — saying it a third time in prose was noise.
        */}
        <div className="mt-3 flex shrink-0 items-center justify-end gap-3 border-t border-brand-divider px-6 py-3.5">

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canPost || isSubmitting}
            className="flex shrink-0 items-center gap-2 rounded-full bg-primary-ink px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-primary-hover disabled:opacity-40"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
            {isSubmitting ? 'Posting…' : 'Post'}
          </button>
        </div>

        {/*
          The footer status bar is gone. It said "Auto-saved as draft", and
          nothing was: post-service has no draft route and this component
          never called one, so the reassurance was false — close the dialog
          and the text was lost. The character count it also carried now sits
          inside the writing card, where the words are. If drafts are wanted,
          that is a backend route first.
        */}

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
