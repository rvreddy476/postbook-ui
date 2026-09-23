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
import { useCreatePost } from '@/hooks/useFeedPosts';
import { useCreateGroupPost } from '@/hooks/useGroups';
import { uploadMedia } from '@/lib/mediaUpload';
import { POST_CONTENT_TYPES } from '@/types/profile';

import PollEditor, { type PollState } from '@/components/studio/PollEditor';
import RichTextEditor from '@/components/studio/RichTextEditor';
import {
  DEFAULT_TEMPLATE,
  POST_TEMPLATES,
  scrimFor,
  templateById,
  type PostAlign,
  type PostRichText,
  type PostVerticalAlign,
  type RichNode,
} from '@/components/studio/postStyle';
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

  /*
    Presentation, all of it stored on the post in rich_text.

    post-service keeps that column as arbitrary JSON, so the template, the
    alignment, the colours, the scale and the uploaded background image all
    persist and come back on read with no backend change — the web was only
    ever putting {background, text_color} in a column that was always general.
  */
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE.id);
  const [align, setAlign] = useState<PostAlign>('left');
  const [valign, setValign] = useState<PostVerticalAlign>('top');
  const [scale, setScale] = useState(1);
  const [textColor, setTextColor] = useState<string | null>(null);
  // The author's own background image: uploaded on pick, so the post carries
  // a media id rather than a blob that dies with the tab.
  const [bgMediaId, setBgMediaId] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
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

  /*
    Choosing a template sets every field it owns at once, so a template is a
    starting point you can then adjust rather than a mode that locks the
    controls. Picking "Plain" clears back to an ordinary card.
  */
  const applyTemplate = (id: string) => {
    const tpl = templateById(id);
    setTemplateId(id);
    setAlign(tpl.style.align ?? 'left');
    setValign(tpl.style.valign ?? 'top');
    setScale(tpl.style.scale ?? 1);
    setBackground(tpl.style.background ?? null);
    setTextColor(tpl.style.text_color ?? null);
  };

  const handleBackgroundImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBgUploading(true);
    // Shown immediately; the upload replaces it with a durable media id.
    const localUrl = URL.createObjectURL(file);
    setBgPreview(localUrl);
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('A background has to be an image.');
      }
      const mediaId = await uploadMedia(file, 'image', 'general');
      setBgMediaId(mediaId);
      // Words over a photo need a light default to read at all.
      if (!textColor) setTextColor('#FFFFFF');
    } catch (err) {
      setBgPreview(null);
      setError(err instanceof Error ? err.message : 'Could not upload that background.');
    } finally {
      setBgUploading(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  const clearBackgroundImage = () => {
    setBgMediaId(null);
    setBgPreview(null);
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
  // A photo behind the words counts as styling too.
  const hasBgImage = Boolean(bgPreview) && isTextOnly;
  const isStyledCard = hasColorBg || hasBgImage;
  /*
    Which way the text has to read. The template's own colour wins when it
    set one; otherwise the swatch's `dark` flag decides, which is what the
    background picker has always used.
  */
  const styleOnDark = isStyledCard
    ? (textColor ? textColor.toUpperCase() !== '#111111' && textColor.toLowerCase() !== '#000000' : onDark || hasBgImage)
    : false;
  const bodyTextColor = textColor ?? (styleOnDark ? '#FFFFFF' : '#111111');

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

      /*
        Everything about how this post LOOKS, in one JSON object on the post.
        post-service stores rich_text as arbitrary JSON and hands it back on
        read, so the template, placement, scale, colours, the author's
        background image and the Journal document all survive the round trip
        and PostCard renders from exactly these fields.

        Null when there is nothing to say: an ordinary text post should not
        carry a style object at all.
      */
      const richText: PostRichText | null = (() => {
        const styled = isTextOnly && (background || bgMediaId || scale !== 1 || align !== 'left' || valign !== 'top');
        if (!styled && !richDoc) return null;
        const value: PostRichText = {};
        if (styled) {
          if (background) value.background = background;
          value.text_color = bodyTextColor;
          value.align = align;
          value.valign = valign;
          value.scale = scale;
          value.template = templateId;
          if (bgMediaId) value.background_media_id = bgMediaId;
        }
        if (richDoc) {
          value.format = 'tiptap';
          value.doc = richDoc;
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

  const chooseMode = (mode: 'poll' | 'journal') => {
    if (mode === 'poll') {
      const next = !showPoll;
      setShowPoll(next);
      if (next) setShowJournal(false);
      else setPoll({ options: ['', ''], duration: '1d', allowMultiple: false });
      return;
    }
    const next = !showJournal;
    setShowJournal(next);
    if (next) setShowPoll(false);
  };

  const hasVideoFile = files.some((f) => f.type.startsWith('video'));
  const tiles = [
    {
      key: 'photo', label: 'Photo', Icon: ImageIcon, title: 'Add photos',
      tint: 'bg-tile-photo/10', fg: 'text-tile-photo', ring: 'ring-tile-photo',
      active: files.length > 0 && !hasVideoFile,
      disabled: files.length >= 10 || showPoll,
      onClick: () => openPicker('image/*'),
    },
    {
      key: 'video', label: 'Video', Icon: VideoIcon, title: 'Add a video',
      tint: 'bg-tile-video/10', fg: 'text-tile-video', ring: 'ring-tile-video',
      active: hasVideoFile,
      disabled: files.length >= 10 || showPoll,
      onClick: () => openPicker('video/*'),
    },
    {
      key: 'poll', label: 'Poll', Icon: BarChart3, title: 'Ask a question with options',
      tint: 'bg-tile-poll/10', fg: 'text-tile-poll', ring: 'ring-tile-poll',
      active: showPoll, disabled: files.length > 0,
      onClick: () => chooseMode('poll'),
    },
    {
      key: 'journal', label: 'Journal', Icon: BookOpen, title: 'Write something longer, with a title',
      tint: 'bg-tile-journal/10', fg: 'text-tile-journal', ring: 'ring-tile-journal',
      active: showJournal, disabled: showPoll,
      onClick: () => chooseMode('journal'),
    },
    {
      key: 'place', label: 'Place', Icon: MapPin, title: 'Add a place',
      tint: 'bg-tile-place/10', fg: 'text-tile-place', ring: 'ring-tile-place',
      active: showLocation || Boolean(location.trim()), disabled: false,
      onClick: () => setShowLocation((v) => !v),
    },
    {
      key: 'tag', label: 'Tag', Icon: Hash, title: 'Add hashtags',
      tint: 'bg-tile-tag/10', fg: 'text-tile-tag', ring: 'ring-tile-tag',
      active: showHashtagInput || hashtags.length > 0, disabled: false,
      onClick: () => setShowHashtagInput((v) => !v),
    },
    {
      key: 'more', label: 'More', Icon: MoreHorizontal, title: 'Feeling, activity and background',
      tint: 'bg-tile-more/10', fg: 'text-tile-more', ring: 'ring-tile-more',
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
              className={`relative overflow-hidden rounded-[20px] p-5 transition-colors duration-300 ${
                isStyledCard ? '' : 'bg-brand-secondary border border-brand-divider text-brand-text'
              } ${valign === 'middle' && isStyledCard ? 'flex min-h-[240px] flex-col justify-center' : ''}`}
              style={isStyledCard ? {
                backgroundColor: background ?? '#101828',
                backgroundImage: bgPreview ? `url(${bgPreview})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: bodyTextColor,
              } : undefined}
            >
              {/* Scrim: a caption over an arbitrary photo is unreadable without one. */}
              {hasBgImage && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ background: scrimFor(bodyTextColor) }}
                />
              )}
              <div className={hasBgImage ? 'relative' : undefined}>
              {showJournal && (
                <input
                  value={journalTitle}
                  onChange={(e) => setJournalTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={120}
                  className={`mb-3 w-full border-b bg-transparent pb-2 text-lg font-semibold -tracking-[0.018em] outline-hidden ${
                    styleOnDark ? 'border-white/25 placeholder:text-current/50' : 'border-brand-divider text-brand-text placeholder:text-brand-text/35'
                  }`}
                />
              )}

              {/*
                Journal is a real editor, not a bigger textarea. It emits the
                ProseMirror document, which is what gets stored in rich_text
                and what the feed renders back through a whitelist.
              */}
              {showJournal ? (
                <RichTextEditor
                  onDark={styleOnDark}
                  placeholder="Write your entry…"
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

          {/*
            Templates. Text and Journal only: a background behind a photo grid
            is noise, so the strip is not offered when there is media, and a
            poll has its own editor.
          */}
          {isTextOnly && (
            <div className="px-6 pt-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {POST_TEMPLATES.map((tpl) => {
                  const active = tpl.id === templateId && !bgMediaId;
                  const swatch = tpl.style.background ?? 'var(--color-brand-secondary)';
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => { clearBackgroundImage(); applyTemplate(tpl.id); }}
                      aria-pressed={active}
                      className={`shrink-0 rounded-xl border p-1 transition-colors ${
                        active ? 'border-primary-ink' : 'border-brand-divider hover:border-brand-text/30'
                      }`}
                    >
                      <span
                        className="flex h-12 w-16 items-center justify-center rounded-lg text-[11px] font-semibold"
                        style={{
                          background: swatch,
                          color: tpl.style.text_color ?? 'rgb(var(--brand-text))',
                          border: tpl.style.background ? 'none' : '1px solid var(--brand-divider)',
                        }}
                      >
                        Aa
                      </span>
                      <span className="mt-1 block text-center text-[10px] text-brand-text/60">{tpl.label}</span>
                    </button>
                  );
                })}

                {/* The author's own image, uploaded rather than kept as a blob. */}
                <button
                  type="button"
                  onClick={() => bgInputRef.current?.click()}
                  disabled={bgUploading}
                  aria-pressed={Boolean(bgMediaId)}
                  className={`shrink-0 rounded-xl border p-1 transition-colors disabled:opacity-50 ${
                    bgMediaId ? 'border-primary-ink' : 'border-brand-divider hover:border-brand-text/30'
                  }`}
                >
                  <span
                    className="flex h-12 w-16 items-center justify-center rounded-lg border border-dashed border-brand-divider bg-brand-secondary"
                    style={bgPreview ? { backgroundImage: `url(${bgPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    {bgUploading
                      ? <Loader2 className="h-4 w-4 animate-spin text-brand-text/60" />
                      : !bgPreview && <ImagePlus className="h-4 w-4 text-brand-text/50" />}
                  </span>
                  <span className="mt-1 block text-center text-[10px] text-brand-text/60">Yours</span>
                </button>

                {bgMediaId && (
                  <button
                    type="button"
                    onClick={clearBackgroundImage}
                    className="shrink-0 self-start rounded-lg px-2 py-1 text-[11px] font-medium text-brand-text/60 hover:text-brand-text"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Placement and size, once the card is styled enough to show it. */}
              {isStyledCard && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-brand-secondary p-1">
                    {([['left', AlignLeft, 'Align left'], ['center', AlignCenter, 'Align centre']] as const).map(([value, Icon, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAlign(value)}
                        aria-label={label}
                        aria-pressed={align === value}
                        title={label}
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${align === value ? 'bg-brand-card text-primary-ink' : 'text-brand-text/60 hover:text-brand-text'}`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 rounded-full bg-brand-secondary p-1">
                    {([['top', AlignStartVertical, 'Top'], ['middle', AlignCenterVertical, 'Middle']] as const).map(([value, Icon, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setValign(value)}
                        aria-label={label}
                        aria-pressed={valign === value}
                        title={label}
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${valign === value ? 'bg-brand-card text-primary-ink' : 'text-brand-text/60 hover:text-brand-text'}`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 rounded-full bg-brand-secondary px-3 py-1.5 text-[11px] text-brand-text/60">
                    Size
                    <input
                      type="range"
                      min={1}
                      max={2}
                      step={0.1}
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                      className="h-1 w-20 accent-primary-ink"
                      aria-label="Text size"
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-full bg-brand-secondary px-3 py-1.5 text-[11px] text-brand-text/60">
                    Text
                    <input
                      type="color"
                      value={bodyTextColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Text colour"
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-full bg-brand-secondary px-3 py-1.5 text-[11px] text-brand-text/60">
                    Card
                    <input
                      type="color"
                      value={background ?? '#101828'}
                      onChange={(e) => setBackground(e.target.value)}
                      className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Card colour"
                    />
                  </label>
                </div>
              )}

              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackgroundImage}
                className="hidden"
              />
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

        {/*
          Seven tiles, after the founder's reference. A tile carries its own
          colour from src/ui/theme.css (never a hex here) and a label, so every
          action is recognisable at a glance and named outright.

          Photo, Video, Poll and Journal are MODES: picking one changes the
          body above, and they are mutually exclusive, because a post cannot be
          a poll and a journal entry at the same time. Place, Tag and More are
          additions that layer onto whichever mode is active.

          The reference also had an "Event" tile. post-service has no event
          content type — post, poll, reel and video are the whole set — so that
          tile could only ever have been a button that did nothing. Journal
          takes its place: it is real and already supported here.
        */}
        <div className="grid shrink-0 grid-cols-4 gap-2 px-6 pt-4 sm:grid-cols-7">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={tile.onClick}
              disabled={tile.disabled}
              aria-pressed={tile.active}
              title={tile.title}
              className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors disabled:opacity-35 ${
                tile.active ? 'bg-brand-secondary' : 'hover:bg-brand-secondary/70'
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${tile.tint} ${
                  tile.active ? 'ring-2 ring-offset-2 ring-offset-brand-card ' + tile.ring : ''
                }`}
              >
                <tile.Icon className={`h-5 w-5 ${tile.fg}`} strokeWidth={2} />
              </span>
              <span className={`text-[11px] font-medium ${tile.active ? 'text-brand-text' : 'text-brand-text/70'}`}>
                {tile.label}
              </span>
            </button>
          ))}
        </div>

        {/* More: the actions that do not earn a tile of their own. */}
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

        {/* What you are about to publish, and the one button that does it. */}
        <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-brand-divider px-6 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-brand-text/60">
            <summary.Icon className="h-4 w-4 shrink-0 text-brand-text/45" strokeWidth={1.75} />
            <span className="font-semibold text-brand-text">{summary.kind}</span>
            {summary.detail && <span className="truncate">· {summary.detail}</span>}
            <span className="inline-flex items-center gap-1">
              · seen by <VisIcon className="h-3 w-3" /> {visOption.label}
            </span>
          </div>

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
