'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  Clock,
  Hash,
  Loader2,
  MapPin,
  Send,
  Settings,
  Smile,
  Sparkles,
  X,
} from 'lucide-react';

import { useMyProfile } from '@/hooks/useEditProfile';
import { useCreatePost } from '@/hooks/useFeedPosts';
import { useCreateGroupPost } from '@/hooks/useGroups';
import { uploadMedia, updateMediaAltText } from '@/lib/mediaUpload';
import { POST_CONTENT_TYPES } from '@/types/profile';

import { POST_TYPES } from '@/components/studio/PostTypeSelector';
import PollEditor, { type PollState } from '@/components/studio/PollEditor';
import MediaUploader from '@/components/studio/MediaUploader';
import MoodActivityPicker from '@/components/studio/MoodActivityPicker';
import PostSettingsPanel from '@/components/studio/PostSettingsPanel';
import VisibilityDropdown, { type PostVisibility } from '@/components/studio/VisibilityDropdown';

interface CreatePortalProps {
  onClose: () => void;
  groupId?: string;
}

const CreatePortal: React.FC<CreatePortalProps> = ({ onClose, groupId }) => {
  const [type, setType] = useState('text');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [poll, setPoll] = useState<PollState>({
    options: ['', ''],
    duration: '1d',
    allowMultiple: false,
  });
  const [altTexts, setAltTexts] = useState<Record<number, string>>({});

  const [quickPanel, setQuickPanel] = useState<'mood' | 'loc' | 'tags' | 'time' | 'settings' | null>(null);
  const [schedule, setSchedule] = useState('');
  const [noComments, setNoComments] = useState(false);
  const [noLikes, setNoLikes] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickPanelRef = useRef<HTMLDivElement>(null);
  const quickPanelToggleRowRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useMyProfile();
  const createPost = useCreatePost();
  const createGroupPost = useCreateGroupPost();

  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=User';
  const displayName = profile?.display_name || 'User';

  const pt = POST_TYPES.find((item) => item.id === type) ?? POST_TYPES[0];
  const accentColor = pt.color;
  const maxChars = type === 'article' ? 50000 : 3000;
  const isMediaType = type === 'photo' || type === 'video';
  const isPoll = type === 'poll';
  const validPollOptions = poll.options.filter((opt) => opt.trim()).length >= 2;
  const canPost = Boolean(text.trim() || files.length > 0 || (isPoll && validPollOptions));

  useEffect(() => {
    setFiles([]);
    setText('');
    setTags([]);
    setError(null);
    setAltTexts({});
    setQuickPanel(null);
  }, [type]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 360)}px`;
    }
  }, [text]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    const parseRgb = (value: string): [number, number, number] | null => {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    };

    const isSurfaceDark = () => {
      const rootTheme = root.getAttribute('data-theme');
      const bodyTheme = body.getAttribute('data-theme');

      if (rootTheme === 'dark' || bodyTheme === 'dark') return true;
      if (rootTheme === 'light' || bodyTheme === 'light') return false;

      const bgCandidates = [
        getComputedStyle(body).backgroundColor,
        getComputedStyle(root).backgroundColor,
      ];
      const bg = bgCandidates.find((color) => color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent');
      const rgb = bg ? parseRgb(bg) : null;
      if (!rgb) return false;

      const [r, g, b] = rgb;
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return luminance < 0.58;
    };

    const syncTheme = () => {
      setIsDarkMode(isSurfaceDark());
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    observer.observe(body, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!quickPanel) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (quickPanelRef.current?.contains(target)) return;
      if (quickPanelToggleRowRef.current?.contains(target)) return;
      setQuickPanel(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [quickPanel]);

  const toggleQuickPanel = (panel: 'mood' | 'loc' | 'tags' | 'time' | 'settings') => {
    setQuickPanel((prev) => (prev === panel ? null : panel));
  };

  const handleTagKey = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ',') && tagInput.trim()) {
      event.preventDefault();
      const tag = tagInput.trim().replace(/^#/, '');
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
        setTagInput('');
      }
      return;
    }

    if (event.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!canPost || isSubmitting) return;

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

        await Promise.all(
          uploaded.map((mediaId, index) => {
            const alt = altTexts[index]?.trim();
            if (!alt) return Promise.resolve();
            return updateMediaAltText(mediaId, alt);
          }),
        );
      }

      let contentType: string = POST_CONTENT_TYPES.POST;
      if (type === 'video') contentType = POST_CONTENT_TYPES.VIDEO;
      if (type === 'poll') contentType = POST_CONTENT_TYPES.POLL;

      let feeling: string | null = null;
      let activity: string | null = null;
      let activityDetail: string | null = null;

      if (mood) {
        const activityLabels = [
          'Listening to',
          'Watching',
          'Playing',
          'Reading',
          'Travelling to',
          'Eating at',
          'Working on',
          'Creating',
        ];
        const activityMatch = activityLabels.find((label) => mood.includes(label));
        if (activityMatch) {
          const parts = mood.split(activityMatch);
          activity = activityMatch;
          activityDetail = parts[1]?.trim() || null;
        } else {
          feeling = mood;
        }
      }

      const durationMap: Record<string, number> = { '1d': 24, '3d': 72, '7d': 168 };
      const pollPayload = isPoll
        ? {
            question: text.trim() || 'Untitled Poll',
            options: poll.options.filter((option) => option.trim()),
            allows_multiple: poll.allowMultiple,
            duration_hours: durationMap[poll.duration] || 24,
          }
        : null;

      const postPayload = {
        text: text.trim(),
        visibility,
        content_type: contentType,
        media_ids: mediaIds,
        feeling,
        activity,
        activity_detail: activityDetail,
        location: location.trim() || null,
        no_comments: noComments || undefined,
        no_likes: noLikes || undefined,
        poll: pollPayload,
      };

      if (groupId) {
        await createGroupPost.mutateAsync({ groupId, ...postPayload });
      } else {
        await createPost.mutateAsync(postPayload);
      }

      onClose();
    } catch (err: unknown) {
      console.error('[CreatePortal] Post creation failed:', err);
      let message = 'Failed to create post. Please try again.';

      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: unknown; status?: number } };
        console.error('[CreatePortal] Backend response:', axiosErr.response?.status, axiosErr.response?.data);
        const respData = axiosErr.response?.data as { error?: { message?: string } } | undefined;
        if (respData?.error?.message) {
          message = `Backend: ${respData.error.message}`;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    altTexts,
    canPost,
    createGroupPost,
    createPost,
    files,
    groupId,
    isPoll,
    isSubmitting,
    location,
    mood,
    noComments,
    noLikes,
    onClose,
    poll,
    text,
    type,
    visibility,
  ]);

  const toolbarItems = [
    {
      key: 'media',
      icon: <Camera className="h-4 w-4" />,
      label: 'Media',
      fn: () => fileInputRef.current?.click(),
      hide: isPoll,
      on: files.length > 0,
    },
    {
      key: 'mood',
      icon: <Smile className="h-4 w-4" />,
      label: 'Mood',
      fn: () => toggleQuickPanel('mood'),
      on: quickPanel === 'mood' || Boolean(mood),
    },
    {
      key: 'loc',
      icon: <MapPin className="h-4 w-4" />,
      label: 'Location',
      fn: () => toggleQuickPanel('loc'),
      on: quickPanel === 'loc' || Boolean(location),
    },
    {
      key: 'tags',
      icon: <Hash className="h-4 w-4" />,
      label: 'Tags',
      fn: () => toggleQuickPanel('tags'),
      on: quickPanel === 'tags' || tags.length > 0,
    },
    {
      key: 'time',
      icon: <Clock className="h-4 w-4" />,
      label: 'Schedule',
      fn: () => toggleQuickPanel('time'),
      on: quickPanel === 'time' || Boolean(schedule),
    },
    {
      key: 'settings',
      icon: <Settings className="h-4 w-4" />,
      label: 'Settings',
      fn: () => toggleQuickPanel('settings'),
      on: quickPanel === 'settings',
    },
  ].filter((item) => !item.hide);

  const toolbarPalette: Record<string, { on: string; off: string }> = isDarkMode
    ? {
        media: {
          on: 'border-sky-300/70 bg-sky-400/25 text-sky-100 ring-1 ring-sky-300/40 shadow-[0_8px_18px_rgba(56,189,248,0.25)]',
          off: 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/10',
        },
        mood: {
          on: 'border-amber-300/70 bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/40 shadow-[0_8px_18px_rgba(251,191,36,0.23)]',
          off: 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/10',
        },
        loc: {
          on: 'border-emerald-300/70 bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40 shadow-[0_8px_18px_rgba(52,211,153,0.23)]',
          off: 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/10',
        },
        tags: {
          on: 'border-indigo-300/70 bg-indigo-400/25 text-indigo-100 ring-1 ring-indigo-300/40 shadow-[0_8px_18px_rgba(129,140,248,0.23)]',
          off: 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/10',
        },
        time: {
          on: 'border-[#D8103F]/70 bg-[#D8103F]/25 text-[#D8103F]/10 ring-1 ring-[#D8103F]/40 shadow-[0_8px_18px_rgba(167,139,250,0.23)]',
          off: 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/10',
        },
        settings: {
          on: 'border-rose-300/70 bg-rose-400/25 text-rose-100 ring-1 ring-rose-300/40 shadow-[0_8px_18px_rgba(251,113,133,0.23)]',
          off: 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/10',
        },
      }
    : {
        media: {
          on: 'border-sky-300 bg-sky-100 text-sky-800 ring-1 ring-sky-300/60 shadow-sm',
          off: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        },
        mood: {
          on: 'border-amber-300 bg-amber-100 text-amber-800 ring-1 ring-amber-300/60 shadow-sm',
          off: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        },
        loc: {
          on: 'border-emerald-300 bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/60 shadow-sm',
          off: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        },
        tags: {
          on: 'border-indigo-300 bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300/60 shadow-sm',
          off: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        },
        time: {
          on: 'border-[#D8103F]/30 bg-[#D8103F]/10 text-[#8a0a28] ring-1 ring-[#D8103F]/60 shadow-sm',
          off: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        },
        settings: {
          on: 'border-rose-300 bg-rose-100 text-rose-800 ring-1 ring-rose-300/60 shadow-sm',
          off: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        },
      };

  const surfaceClass = isDarkMode
    ? 'rounded-2xl border border-white/10 bg-[#0D1324]'
    : 'rounded-2xl border border-slate-200 bg-white';

  const inputWrapClass = isDarkMode
    ? 'flex items-center gap-2 rounded-xl border border-white/10 bg-[#10182D] px-3 py-2'
    : 'flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2';

  const pillMoodClass = isDarkMode
    ? 'inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-medium text-amber-300'
    : 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700';

  const pillLocationClass = isDarkMode
    ? 'inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-emerald-300'
    : 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 18 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="mx-2 w-full max-w-[960px] sm:mx-4"
    >
      <div
        className={`relative flex h-[92vh] max-h-[860px] flex-col overflow-hidden rounded-3xl border ${
          isDarkMode
            ? 'border-white/10 bg-[#050A16] shadow-[0_35px_80px_-25px_rgba(2,6,23,0.75)]'
            : 'border-slate-200 bg-white shadow-[0_25px_70px_-25px_rgba(15,23,42,0.32)]'
        }`}
      >
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-20 ${
            isDarkMode
              ? 'bg-gradient-to-r from-[#121c34] via-[#0d1428] to-[#111b33]'
              : 'bg-gradient-to-r from-slate-50 via-white to-white'
          }`}
        />

        <div
          className={`relative z-10 border-b px-4 py-3 sm:px-6 sm:py-4 ${
            isDarkMode ? 'border-white/10 bg-[#0B1020]/85' : 'border-slate-200 bg-white/95'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className={`h-4 w-4 ${isDarkMode ? 'text-orange-300' : 'text-blue-600'}`} />
                <h2 className={`truncate text-[18px] font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Create Post</h2>
              </div>
              <p className={`mt-0.5 text-[12px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {schedule
                  ? `Scheduled for ${new Date(schedule).toLocaleString()}`
                  : 'Clean, responsive composer with full post controls.'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={onClose}
                className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-[13px] font-medium transition ${
                  isDarkMode
                    ? 'border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-slate-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-[13px] font-medium transition ${
                  isDarkMode
                    ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Save Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canPost || isSubmitting}
                className="inline-flex h-10 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-[13px] font-semibold text-white transition hover:from-orange-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:from-slate-500 disabled:to-slate-500"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {schedule ? 'Schedule Post' : 'Publish Post'}
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className={`mt-3 rounded-xl border px-3 py-2 text-[12px] font-medium ${
              isDarkMode ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}>
              {error}
            </div>
          )}
        </div>

        <div className={`relative flex min-h-0 flex-1 ${isDarkMode ? 'bg-[#070b16] text-slate-100' : 'bg-white text-slate-900'}`}>
          <aside className={`hidden min-h-0 w-[104px] shrink-0 border-r md:flex md:flex-col md:py-4 ${
            isDarkMode ? 'border-white/10 bg-[#0B1020]' : 'border-slate-200 bg-white'
          }`}>
            <div className="scrollbar-hide flex-1 space-y-1 overflow-y-auto px-2">
              {POST_TYPES.map((typeItem) => {
                const active = type === typeItem.id;
                return (
                  <button
                    key={typeItem.id}
                    onClick={() => setType(typeItem.id)}
                    className={`w-full rounded-2xl border px-2 py-3 transition ${
                      active
                        ? isDarkMode
                          ? 'border-white/20 bg-white/10 shadow-[0_8px_20px_rgba(2,6,23,0.5)]'
                          : 'border-slate-200 bg-slate-50 shadow-sm'
                        : isDarkMode
                          ? 'border-transparent hover:border-white/10 hover:bg-white/5'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${typeItem.color}24`, color: typeItem.color }}>
                        {typeItem.icon}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: active ? typeItem.color : '#94A3B8' }}>
                        {typeItem.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className={`border-b px-4 py-3 md:hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                {POST_TYPES.map((typeItem) => {
                  const active = type === typeItem.id;
                  return (
                    <button
                      key={`mobile-${typeItem.id}`}
                      onClick={() => setType(typeItem.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium whitespace-nowrap transition ${
                        active
                          ? isDarkMode ? 'border-white/20 bg-white/10' : 'border-slate-200 bg-slate-50'
                          : isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'
                      }`}
                      style={{ color: active ? typeItem.color : '#94A3B8' }}
                    >
                      {typeItem.icon}
                      {typeItem.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`relative border-b px-4 py-3 sm:px-6 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <div ref={quickPanelToggleRowRef} className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
                <span className="mr-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Add To Post
                </span>
                {toolbarItems.map((item) => {
                  const palette = toolbarPalette[item.key] ?? {
                    on: 'border-blue-300/70 bg-blue-400/20 text-blue-100',
                    off: 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                  };
                  return (
                    <button
                      key={item.key}
                      onClick={item.fn}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold whitespace-nowrap transition duration-200 ${
                        item.on ? palette.on : palette.off
                      } ${item.on ? 'translate-y-[-1px]' : ''}`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {quickPanel && (
                <div
                  ref={quickPanelRef}
                  className={`absolute left-4 right-4 top-full z-20 mt-2 rounded-2xl border p-3 shadow-xl sm:right-auto sm:w-[540px] ${
                    isDarkMode ? 'border-white/10 bg-[#0D1324]' : 'border-slate-200 bg-white'
                  }`}
                >
                  {quickPanel === 'mood' && (
                    <MoodActivityPicker
                      accentColor={accentColor}
                      isDarkMode={isDarkMode}
                      onSelect={(selectedMood) => {
                        setMood(selectedMood);
                        setQuickPanel(null);
                      }}
                      onClose={() => setQuickPanel(null)}
                    />
                  )}

                  {quickPanel === 'tags' && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className={`text-[11px] font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tags</label>
                        <button
                          onClick={() => setQuickPanel(null)}
                          className={`text-slate-400 ${isDarkMode ? 'hover:text-slate-200' : 'hover:text-slate-700'}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className={`flex flex-wrap items-center gap-1.5 rounded-xl border px-3 py-2 ${
                        isDarkMode ? 'border-white/10 bg-[#10182D]' : 'border-slate-200 bg-slate-50'
                      }`}>
                        {tags.map((tag, index) => (
                          <span
                            key={`${tag}-${index}`}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              isDarkMode ? 'bg-indigo-400/20 text-indigo-200' : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            #{tag}
                            <button onClick={() => setTags(tags.filter((_, tagIndex) => tagIndex !== index))}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          value={tagInput}
                          onChange={(event) => setTagInput(event.target.value)}
                          onKeyDown={handleTagKey}
                          placeholder={tags.length ? '' : 'Add tags and press Enter'}
                          className={`min-w-[120px] flex-1 bg-transparent text-[12px] outline-none ${
                            isDarkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {quickPanel === 'loc' && (
                    <div>
                      <label className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Location</label>
                      <div className={inputWrapClass}>
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <input
                          value={location}
                          onChange={(event) => setLocation(event.target.value)}
                          placeholder="Where are you?"
                          className={`flex-1 bg-transparent text-[13px] outline-none ${
                            isDarkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'
                          }`}
                        />
                        <button
                          onClick={() => {
                            setQuickPanel(null);
                          }}
                          className={`text-slate-400 ${isDarkMode ? 'hover:text-slate-200' : 'hover:text-slate-600'}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {quickPanel === 'time' && (
                    <div>
                      <label className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Schedule</label>
                      <div className={inputWrapClass}>
                        <Clock className="h-4 w-4 text-slate-400" />
                        <input
                          type="datetime-local"
                          value={schedule}
                          onChange={(event) => setSchedule(event.target.value)}
                          className={`flex-1 bg-transparent text-[13px] outline-none ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}
                        />
                        <button
                          onClick={() => {
                            setSchedule('');
                            setQuickPanel(null);
                          }}
                          className={`text-slate-400 ${isDarkMode ? 'hover:text-slate-200' : 'hover:text-slate-600'}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {quickPanel === 'settings' && (
                    <PostSettingsPanel
                      noComments={noComments}
                      noLikes={noLikes}
                      pinned={pinned}
                      onToggleComments={() => setNoComments((prev) => !prev)}
                      onToggleLikes={() => setNoLikes((prev) => !prev)}
                      onTogglePinned={() => setPinned((prev) => !prev)}
                      accentColor={accentColor}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>
              )}
            </div>

            <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-4">
                <div className={`${surfaceClass} p-4 sm:p-5`}>
                  <div className="mb-4 flex items-start gap-3">
                    <img
                      src={avatarSrc}
                      alt={displayName}
                      className={`h-11 w-11 rounded-xl border object-cover ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[14px] font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{displayName}</p>
                      <div className="mt-1">
                        <VisibilityDropdown value={visibility} onChange={setVisibility} accentColor={accentColor} isDarkMode={isDarkMode} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        {mood && (
                          <span className={pillMoodClass}>
                            {mood}
                            <button onClick={() => setMood(null)}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                        {location && (
                          <span className={pillLocationClass}>
                            <MapPin className="h-3 w-3" />
                            {location}
                            <button onClick={() => setLocation('')}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={
                      isPoll
                        ? 'What do you want to ask your audience?'
                        : type === 'article'
                          ? 'Start writing your article...'
                          : `What's on your mind, ${displayName.split(' ')[0]}?`
                    }
                    rows={type === 'article' ? 10 : 6}
                    className={`w-full resize-none bg-transparent text-[16px] leading-8 outline-none ${
                      isDarkMode ? 'text-white placeholder:text-slate-400' : 'text-slate-900 placeholder:text-slate-400'
                    }`}
                    style={{
                      fontFamily: type === 'article' ? "'Instrument Serif', Georgia, serif" : 'inherit',
                      fontSize: type === 'article' ? '20px' : '16px',
                    }}
                  />

                  {text.length > 0 && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className={`h-[3px] flex-1 overflow-hidden rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((text.length / maxChars) * 100, 100)}%`,
                            background: text.length > maxChars ? '#F87171' : accentColor,
                          }}
                        />
                      </div>
                      <span className={`text-[11px] font-medium tabular-nums ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {text.length.toLocaleString()}/{maxChars.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {isPoll && (
                  <div className={`${surfaceClass} p-4 sm:p-5`}>
                    <PollEditor poll={poll} onChange={setPoll} accentColor={accentColor} isDarkMode={isDarkMode} />
                  </div>
                )}

                {isMediaType && (
                  <div className={`${surfaceClass} p-4 sm:p-5`}>
                    <MediaUploader
                      files={files}
                      onChange={setFiles}
                      isVideo={type === 'video'}
                      accentColor={accentColor}
                      isDarkMode={isDarkMode}
                      altTexts={altTexts}
                      onAltTextChange={(index, value) => setAltTexts((prev) => ({ ...prev, [index]: value }))}
                    />
                  </div>
                )}

              </div>
            </section>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={type === 'video' ? 'video/*' : 'image/*'}
          multiple={type !== 'video'}
          onChange={(event) => setFiles((prev) => [...prev, ...Array.from(event.target.files || [])])}
          className="hidden"
        />
      </div>
    </motion.div>
  );
};

export default CreatePortal;
