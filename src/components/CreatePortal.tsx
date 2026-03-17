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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 18 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="mx-2 w-full max-w-[960px] sm:mx-4"
    >
      <div
        className="relative flex h-[92vh] max-h-[860px] flex-col overflow-hidden rounded-3xl border border-brand-divider bg-brand-card shadow-[0_25px_70px_-25px_rgba(48,47,44,0.32)]"
      >
        {/* Header */}
        <div className="relative z-10 border-b border-brand-divider px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-accent" />
                <h2 className="truncate text-[18px] font-semibold text-brand-text">Create Post</h2>
              </div>
              <p className="mt-0.5 text-[12px] text-brand-text/60">
                {schedule
                  ? `Scheduled for ${new Date(schedule).toLocaleString()}`
                  : 'Clean, responsive composer with full post controls.'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-brand-divider px-4 text-[13px] font-medium text-brand-text/60 transition hover:text-brand-text hover:bg-brand-accent/5"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-brand-divider px-4 text-[13px] font-medium text-brand-text/60 transition hover:text-brand-text hover:bg-brand-accent/5"
              >
                Save Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canPost || isSubmitting}
                className="inline-flex h-10 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 text-[10px] font-black uppercase tracking-widest text-brand-bg transition hover:shadow-[0_0_20px_rgba(48,47,44,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="mt-3 rounded-xl border px-3 py-2 text-[12px] font-medium border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="relative flex min-h-0 flex-1 text-brand-text">
          {/* Post type sidebar (desktop) */}
          <aside className="hidden min-h-0 w-[104px] shrink-0 border-r border-brand-divider md:flex md:flex-col md:py-4">
            <div className="scrollbar-hide flex-1 space-y-1 overflow-y-auto px-2">
              {POST_TYPES.map((typeItem) => {
                const active = type === typeItem.id;
                return (
                  <button
                    key={typeItem.id}
                    onClick={() => setType(typeItem.id)}
                    className={`w-full rounded-2xl px-2 py-3 transition ${
                      active
                        ? 'bg-brand-accent/10'
                        : 'hover:bg-brand-accent/5'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${typeItem.color}24`, color: typeItem.color }}>
                        {typeItem.icon}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${active ? '' : 'text-brand-text/40'}`} style={active ? { color: typeItem.color } : undefined}>
                        {typeItem.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Post type selector (mobile) */}
            <div className="border-b border-brand-divider px-4 py-3 md:hidden">
              <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                {POST_TYPES.map((typeItem) => {
                  const active = type === typeItem.id;
                  return (
                    <button
                      key={`mobile-${typeItem.id}`}
                      onClick={() => setType(typeItem.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium whitespace-nowrap transition ${
                        active
                          ? 'bg-brand-accent/10 border-brand-divider'
                          : 'border-brand-divider hover:bg-brand-accent/5'
                      }`}
                      style={{ color: active ? typeItem.color : undefined }}
                    >
                      {typeItem.icon}
                      {typeItem.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toolbar row */}
            <div className="relative border-b border-brand-divider px-4 py-3 sm:px-6">
              <div ref={quickPanelToggleRowRef} className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
                <span className="mr-2 whitespace-nowrap text-[10px] font-black tracking-widest uppercase text-brand-text/60">
                  Add To Post
                </span>
                {toolbarItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={item.fn}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold whitespace-nowrap transition duration-200 ${
                      item.on
                        ? 'border-brand-accent/30 bg-brand-accent/10 text-brand-text'
                        : 'border-brand-divider text-brand-text/60 hover:text-brand-text hover:bg-brand-accent/5'
                    } ${item.on ? 'translate-y-[-1px]' : ''}`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Quick panels */}
              {quickPanel && (
                <div
                  ref={quickPanelRef}
                  className="absolute left-4 right-4 top-full z-20 mt-2 border border-brand-divider rounded-2xl p-3 shadow-xl bg-brand-card sm:right-auto sm:w-[540px]"
                >
                  {quickPanel === 'mood' && (
                    <MoodActivityPicker
                      accentColor={accentColor}
                      isDarkMode={false}
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
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-brand-text/60">Tags</label>
                        <button
                          onClick={() => setQuickPanel(null)}
                          className="text-brand-text/60 hover:text-brand-text"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2">
                        {tags.map((tag, index) => (
                          <span
                            key={`${tag}-${index}`}
                            className="inline-flex items-center gap-1 rounded-md bg-brand-accent/10 px-2 py-0.5 text-[11px] font-medium text-brand-text"
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
                          className="min-w-[120px] flex-1 bg-transparent text-[12px] text-brand-text placeholder:text-brand-text/40 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {quickPanel === 'loc' && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-text/60">Location</label>
                      <div className="flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2">
                        <MapPin className="h-4 w-4 text-brand-text/60" />
                        <input
                          value={location}
                          onChange={(event) => setLocation(event.target.value)}
                          placeholder="Where are you?"
                          className="flex-1 bg-transparent text-[13px] text-brand-text placeholder:text-brand-text/40 outline-none"
                        />
                        <button
                          onClick={() => {
                            setQuickPanel(null);
                          }}
                          className="text-brand-text/60 hover:text-brand-text"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {quickPanel === 'time' && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-text/60">Schedule</label>
                      <div className="flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2">
                        <Clock className="h-4 w-4 text-brand-text/60" />
                        <input
                          type="datetime-local"
                          value={schedule}
                          onChange={(event) => setSchedule(event.target.value)}
                          className="flex-1 bg-transparent text-[13px] text-brand-text outline-none"
                        />
                        <button
                          onClick={() => {
                            setSchedule('');
                            setQuickPanel(null);
                          }}
                          className="text-brand-text/60 hover:text-brand-text"
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
                      isDarkMode={false}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Content area */}
            <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-4">
                {/* Text area card */}
                <div className="p-0 sm:p-1">
                  <div className="mb-4 flex items-start gap-3">
                    <img
                      src={avatarSrc}
                      alt={displayName}
                      className="h-11 w-11 rounded-xl border border-brand-divider object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-brand-text">{displayName}</p>
                      <div className="mt-1">
                        <VisibilityDropdown value={visibility} onChange={setVisibility} accentColor={accentColor} isDarkMode={false} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-brand-text/60">
                        {mood && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/10 px-2 py-0.5 font-medium text-brand-text">
                            {mood}
                            <button onClick={() => setMood(null)}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                        {location && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/10 px-2 py-0.5 text-brand-text">
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
                    className="w-full resize-none bg-transparent text-[16px] leading-8 text-brand-text placeholder:text-brand-text/40 outline-none"
                    style={{
                      fontFamily: type === 'article' ? "'Instrument Serif', Georgia, serif" : 'inherit',
                      fontSize: type === 'article' ? '20px' : '16px',
                    }}
                  />

                  {text.length > 0 && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-brand-secondary">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((text.length / maxChars) * 100, 100)}%`,
                            background: text.length > maxChars ? '#F87171' : accentColor,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-medium tabular-nums text-brand-text/60">
                        {text.length.toLocaleString()}/{maxChars.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {isPoll && (
                  <div className="p-0 sm:p-1">
                    <PollEditor poll={poll} onChange={setPoll} accentColor={accentColor} isDarkMode={false} />
                  </div>
                )}

                {isMediaType && (
                  <div className="p-0 sm:p-1">
                    <MediaUploader
                      files={files}
                      onChange={setFiles}
                      isVideo={type === 'video'}
                      accentColor={accentColor}
                      isDarkMode={false}
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
