'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMyProfile } from '@/hooks/useEditProfile';
import { useCreatePost } from '@/hooks/useFeedPosts';
import { useCreateGroupPost } from '@/hooks/useGroups';
import { uploadMedia, updateMediaAltText } from '@/lib/mediaUpload';
import { motion } from 'framer-motion';
import {
  X,
  Smile,
  MapPin,
  Clock,
  Settings,
  Camera,
  Loader2,
  Coffee,
  Send,
} from 'lucide-react';

import PostTypeSelector, { POST_TYPES } from '@/components/studio/PostTypeSelector';
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
  // Core state
  const [type, setType] = useState('text');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [poll, setPoll] = useState<PollState>({ options: ['', ''], duration: '1d', allowMultiple: false });
  const [altTexts, setAltTexts] = useState<Record<number, string>>({});

  // UI toggles
  const [showLocation, setShowLocation] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [schedule, setSchedule] = useState('');
  const [noComments, setNoComments] = useState(false);
  const [noLikes, setNoLikes] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useMyProfile();
  const createPost = useCreatePost();
  const createGroupPost = useCreateGroupPost();

  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=User';
  const displayName = profile?.display_name || 'User';

  const pt = POST_TYPES.find((t) => t.id === type)!;
  const maxChars = type === 'article' ? 50000 : 3000;
  const isMediaType = type === 'photo' || type === 'video';
  const isPoll = type === 'poll';
  const canPost = text.trim() || files.length > 0 || (isPoll && poll.options.filter((o) => o.trim()).length >= 2);

  // Reset content on type change
  useEffect(() => {
    setFiles([]);
    setText('');
    setTags([]);
    setError(null);
    setAltTexts({});
  }, [type]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 360) + 'px';
    }
  }, [text]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleTagKey = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/^#/, '');
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
        setTagInput('');
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
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
          files.map((f) => {
            const fileType: 'image' | 'video' = f.type.startsWith('video') ? 'video' : 'image';
            return uploadMedia(f, fileType, 'general');
          })
        );
        mediaIds = uploaded;

        // Set alt text for each uploaded media that has one
        await Promise.all(
          uploaded.map((mediaId, index) => {
            const alt = altTexts[index]?.trim();
            if (alt) {
              return updateMediaAltText(mediaId, alt);
            }
            return Promise.resolve();
          })
        );
      }

      let contentType = 'post';
      if (type === 'photo') contentType = 'photo';
      else if (type === 'video') contentType = 'video';
      else if (type === 'article') contentType = 'article';
      else if (type === 'poll') contentType = 'poll';

      let feeling: string | null = null;
      let activity: string | null = null;
      let activityDetail: string | null = null;
      if (mood) {
        const activityLabels = ['Listening to', 'Watching', 'Playing', 'Reading', 'Travelling to', 'Eating at', 'Working on', 'Creating'];
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
            options: poll.options.filter((o) => o.trim()),
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
      let msg = 'Failed to create post. Please try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: unknown; status?: number } };
        console.error('[CreatePortal] Backend response:', axiosErr.response?.status, axiosErr.response?.data);
        const respData = axiosErr.response?.data as { error?: { message?: string } } | undefined;
        if (respData?.error?.message) {
          msg = `Backend: ${respData.error.message}`;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [canPost, isSubmitting, files, type, mood, isPoll, text, visibility, poll, location, noComments, noLikes, createPost, onClose]);

  const toolbarItems = [
    { key: 'media', icon: <Camera className="w-5 h-5" />, label: 'Photo', fn: () => fileInputRef.current?.click(), hide: isPoll, on: files.length > 0 },
    { key: 'mood', icon: <Smile className="w-5 h-5" />, label: 'Mood', fn: () => setShowMood(!showMood), on: showMood || !!mood },
    { key: 'loc', icon: <MapPin className="w-5 h-5" />, label: 'Place', fn: () => setShowLocation(!showLocation), on: showLocation || !!location },
    { key: 'time', icon: <Clock className="w-5 h-5" />, label: 'Schedule', fn: () => setShowSchedule(!showSchedule), on: showSchedule || !!schedule },
    { key: 'gear', icon: <Settings className="w-5 h-5" />, label: 'More', fn: () => setShowSettings(!showSettings), on: showSettings },
  ].filter((b) => !b.hide);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto scrollbar-hide mx-4"
    >
      <div
        className="relative bg-white rounded-2xl overflow-hidden"
        style={{
          boxShadow: '0 25px 60px rgba(60,36,21,0.15), 0 0 0 1px rgba(60,36,21,0.05)',
        }}
      >
        {/* Coffee accent bar */}
        <div className="h-1 bg-gradient-to-r from-[#D4A574] via-[#7B5B3A] to-[#D4A574]" />

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F0E6DC' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FAF5F0' }}>
              <Coffee className="w-4 h-4" style={{ color: '#7B5B3A' }} />
            </div>
            <h2 className="text-[18px] font-bold" style={{ color: '#3C2415' }}>Create Post</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#FAF5F0] transition-colors"
          >
            <X className="w-4 h-4" style={{ color: '#A08070' }} />
          </button>
        </div>

        {/* ── Type Tabs ── */}
        <PostTypeSelector activeType={type} onSelect={setType} />

        {/* ── Author Row ── */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <img
              src={avatarSrc}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover ring-2"
              style={{ '--tw-ring-color': '#F0E6DC' } as React.CSSProperties}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold" style={{ color: '#3C2415' }}>{displayName}</span>
                {mood && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full animate-fadeIn"
                    style={{ background: '#FAF5F0', color: '#7B5B3A' }}
                  >
                    {mood}
                    <button onClick={() => setMood(null)} className="opacity-60 hover:opacity-100 ml-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <VisibilityDropdown value={visibility} onChange={setVisibility} accentColor={pt.color} />
                {location && (
                  <span className="text-[10px] flex items-center gap-1" style={{ color: '#A08070' }}>
                    <MapPin className="w-2.5 h-2.5" /> {location}
                    <button onClick={() => setLocation('')} className="opacity-50 hover:opacity-100">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Compose Area ── */}
        <div className="px-5 py-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              isPoll ? "What do you want to ask?"
                : type === 'article' ? "Begin writing your story..."
                  : `What's on your mind, ${displayName.split(' ')[0]}?`
            }
            rows={type === 'article' ? 10 : 4}
            className="w-full bg-transparent text-[15px] leading-[1.7] placeholder:text-[#D4C4B0] focus:outline-none resize-none"
            style={{
              color: '#3C2415',
              caretColor: '#7B5B3A',
              fontFamily: type === 'article' ? "'Instrument Serif', Georgia, serif" : 'inherit',
              fontSize: type === 'article' ? '18px' : '15px',
            }}
          />
          {text.length > 0 && (
            <div className="flex items-center justify-between mt-1 animate-fadeIn">
              <div className="flex-1 h-[2px] rounded-full mr-3 overflow-hidden" style={{ background: '#F0E6DC' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min((text.length / maxChars) * 100, 100)}%`,
                    background: text.length > maxChars ? '#DC2626' : '#7B5B3A',
                  }}
                />
              </div>
              <span className="text-[10px] font-mono tabular-nums" style={{ color: '#C4B5A6' }}>
                {text.length.toLocaleString()}/{maxChars.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* ── Poll Editor ── */}
        {isPoll && (
          <div className="px-5 pb-4">
            <PollEditor poll={poll} onChange={setPoll} accentColor={pt.color} />
          </div>
        )}

        {/* ── Media Uploader ── */}
        {isMediaType && (
          <div className="px-5 pb-4">
            <MediaUploader
              files={files}
              onChange={setFiles}
              isVideo={type === 'video'}
              accentColor={pt.color}
              altTexts={altTexts}
              onAltTextChange={(index, value) =>
                setAltTexts((prev) => ({ ...prev, [index]: value }))
              }
            />
          </div>
        )}

        {/* ── Tags ── */}
        {text.length > 0 && (
          <div className="px-5 pb-3 animate-fadeIn">
            <div
              className="flex flex-wrap gap-1.5 items-center rounded-xl px-3 py-2 border transition-colors focus-within:ring-1"
              style={{ borderColor: '#F0E6DC', background: '#FAFAFA', '--tw-ring-color': '#7B5B3A30' } as React.CSSProperties}
            >
              <span className="text-[10px] font-medium" style={{ color: '#C4B5A6' }}>#</span>
              {tags.map((t, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-[10px] px-2 py-[2px] rounded-md"
                  style={{ background: '#FAF5F0', color: '#7B5B3A' }}
                >
                  {t}
                  <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                placeholder={tags.length ? '' : 'Add tags...'}
                className="flex-1 min-w-[50px] bg-transparent text-[11px] placeholder:text-[#D4C4B0] focus:outline-none"
                style={{ color: '#5D4037' }}
              />
            </div>
          </div>
        )}

        {/* ── Mood/Activity Picker ── */}
        {showMood && (
          <div className="px-5 pb-3">
            <MoodActivityPicker
              accentColor={pt.color}
              onSelect={(m) => { setMood(m); setShowMood(false); }}
              onClose={() => setShowMood(false)}
            />
          </div>
        )}

        {/* ── Location Input ── */}
        {showLocation && (
          <div className="px-5 pb-3 animate-fadeIn">
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 border focus-within:ring-1"
              style={{ borderColor: '#F0E6DC', background: '#FAFAFA', '--tw-ring-color': '#7B5B3A30' } as React.CSSProperties}
            >
              <MapPin className="w-4 h-4" style={{ color: '#C4B5A6' }} />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where are you?"
                autoFocus
                className="flex-1 bg-transparent text-[13px] placeholder:text-[#D4C4B0] focus:outline-none"
                style={{ color: '#3C2415' }}
              />
              <button onClick={() => { setShowLocation(false); setLocation(''); }} className="text-[#C4B5A6] hover:text-[#7B5B3A] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Schedule Input ── */}
        {showSchedule && (
          <div className="px-5 pb-3 animate-fadeIn">
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 border"
              style={{ borderColor: '#F0E6DC', background: '#FAFAFA' }}
            >
              <Clock className="w-4 h-4" style={{ color: '#C4B5A6' }} />
              <input
                type="datetime-local"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="flex-1 bg-transparent text-[13px] focus:outline-none"
                style={{ color: '#3C2415' }}
              />
              <button onClick={() => { setShowSchedule(false); setSchedule(''); }} className="text-[#C4B5A6] hover:text-[#7B5B3A] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Settings Panel ── */}
        {showSettings && (
          <div className="px-5 pb-3">
            <PostSettingsPanel
              noComments={noComments}
              noLikes={noLikes}
              pinned={pinned}
              onToggleComments={() => setNoComments(!noComments)}
              onToggleLikes={() => setNoLikes(!noLikes)}
              onTogglePinned={() => setPinned(!pinned)}
              accentColor={pt.color}
            />
          </div>
        )}

        {/* ── Toolbar (vertical icon grid) ── */}
        <div className="px-5 py-3" style={{ borderTop: '1px solid #F0E6DC' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {toolbarItems.map((b) => (
                <button
                  key={b.key}
                  onClick={b.fn}
                  className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200"
                  style={{
                    color: b.on ? '#7B5B3A' : '#A08070',
                    background: b.on ? '#FAF5F0' : 'transparent',
                  }}
                >
                  {b.icon}
                  <span className="text-[9px] font-medium">{b.label}</span>
                </button>
              ))}
            </div>
            <span className="hidden sm:flex items-center gap-1 text-[9px]" style={{ color: '#C4B5A6' }}>
              <kbd className="px-1.5 py-0.5 rounded text-[8px] font-mono" style={{ background: '#FAF5F0', border: '1px solid #F0E6DC' }}>Esc</kbd>
              close
            </span>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={type === 'video' ? 'video/*' : 'image/*'}
          multiple={type !== 'video'}
          onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
          className="hidden"
        />

        {/* ── Error ── */}
        {error && (
          <div className="mx-5 mb-3 text-[12px] px-4 py-2.5 border rounded-xl" style={{ color: '#8B4513', background: '#FFF8F0', borderColor: '#F0E6DC' }}>
            {error}
          </div>
        )}

        {/* ── Publish Button (full width) ── */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSubmit}
            disabled={!canPost || isSubmitting}
            className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{
              background: canPost && !isSubmitting
                ? 'linear-gradient(135deg, #7B5B3A, #A0714F)'
                : '#E0D5C8',
              boxShadow: canPost && !isSubmitting ? '0 4px 20px rgba(123,91,58,0.3)' : 'none',
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                {schedule ? 'Schedule Post' : 'Publish Post'}
              </span>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CreatePortal;
