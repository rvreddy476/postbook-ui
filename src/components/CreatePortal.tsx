'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  BarChart3,
  Hash,
  Loader2,
  MapPin,
  Send,
  Smile,
  X,
  Globe,
  Lock,
  Users,
  ChevronDown,
  Palette,
  Plus,
} from 'lucide-react';

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

type PostVisibility = 'public' | 'followers' | 'private';

// Background color presets for text posts
const BG_PRESETS = [
  null, // no background (default)
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', text: '#5a2d3a' },
  { bg: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)', text: '#fff' },
  { bg: '#1a1a2e', text: '#e0e0ff' },
  { bg: '#2d1b69', text: '#e8d5ff' },
  { bg: '#1b4332', text: '#d8f3dc' },
  { bg: '#7f1d1d', text: '#fecaca' },
];

// Swatch colors for the gradient preview circles
const SWATCH_COLORS = [
  'transparent',
  '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
  '#a18cd1', '#fccb90', '#ff9a9e', '#0c3483',
  '#1a1a2e', '#2d1b69', '#1b4332', '#7f1d1d',
];

const CreatePortal: React.FC<CreatePortalProps> = ({ onClose, groupId }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [showMood, setShowMood] = useState(false);
  const [location, setLocation] = useState('');
  const [showLocation, setShowLocation] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [poll, setPoll] = useState<PollState>({ options: ['', ''], duration: '1d', allowMultiple: false });
  const [bgIndex, setBgIndex] = useState(0); // 0 = no background
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#667eea');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useMyProfile();
  const createPost = useCreatePost();
  const createGroupPost = useCreateGroupPost();

  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=User';
  const displayName = profile?.display_name || 'User';
  const firstName = displayName.split(' ')[0];

  const activeBg = BG_PRESETS[bgIndex] ?? null;
  const hasColorBg = activeBg !== null;
  const isTextOnly = files.length === 0 && !showPoll;

  const validPollOptions = poll.options.filter((o) => o.trim()).length >= 2;
  const canPost = Boolean(text.trim() || files.length > 0 || (showPoll && validPollOptions));
  const charCount = text.length;
  const maxChars = 3000;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxH = hasColorBg && isTextOnly ? 160 : 200;
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxH)}px`;
    }
  }, [text, hasColorBg, isTextOnly]);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
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

  // Reset bg when media/poll added
  useEffect(() => {
    if (files.length > 0 || showPoll) setBgIndex(0);
  }, [files.length, showPoll]);

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

      // Build rich_text with background color if selected (text-only posts only)
      const richText = (hasColorBg && isTextOnly && activeBg)
        ? { background: activeBg.bg, text_color: activeBg.text }
        : null;

      const payload = {
        text: text.trim(),
        visibility,
        content_type: contentType,
        media_ids: mediaIds,
        feeling,
        activity,
        activity_detail: activityDetail,
        location: location.trim() || null,
        poll: pollPayload,
        rich_text: richText,
      };

      if (groupId) {
        await createGroupPost.mutateAsync({ groupId, ...payload });
      } else {
        await createPost.mutateAsync(payload);
      }
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
  }, [canPost, createGroupPost, createPost, files, groupId, isSubmitting, location, mood, onClose, poll, showPoll, text, visibility]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSubmit]);

  const visIcons: Record<PostVisibility, React.ReactNode> = {
    public: <Globe className="w-3 h-3" />,
    followers: <Users className="w-3 h-3" />,
    private: <Lock className="w-3 h-3" />,
  };
  const visLabels: Record<PostVisibility, string> = {
    public: 'Everyone',
    followers: 'Followers',
    private: 'Only Me',
  };

  // Accent color derived from selected background
  const accentGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="mx-3 w-full max-w-[520px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-brand-card shadow-[0_25px_60px_-12px_rgba(102,126,234,0.25)] max-h-[85vh]">
        {/* Header — subtle gradient accent */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: accentGradient }}
        >
          <h2 className="text-sm font-bold text-white">Create Post</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* Author row */}
        <div className="px-4 pt-3 flex items-center gap-2.5">
          <img src={avatarSrc} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-200" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-brand-text truncate">{displayName}</p>
            <div className="relative">
              <button
                onClick={() => setShowVisMenu(!showVisMenu)}
                className="flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-50 to-blue-50 text-[10px] font-semibold text-purple-600 hover:from-purple-100 hover:to-blue-100 transition-all"
              >
                {visIcons[visibility]}
                {visLabels[visibility]}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {showVisMenu && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-brand-divider rounded-xl shadow-xl py-1 min-w-[130px]">
                  {(['public', 'followers', 'private'] as PostVisibility[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => { setVisibility(v); setShowVisMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium hover:bg-purple-50 transition-colors ${visibility === v ? 'text-purple-600' : 'text-brand-text/60'}`}
                    >
                      {visIcons[v]}
                      {visLabels[v]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mood / Location chips */}
        {(mood || location) && (
          <div className="px-4 pt-2 flex flex-wrap gap-1.5">
            {mood && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/50">
                {mood}
                <button onClick={() => setMood(null)} className="hover:text-amber-900"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-50 to-cyan-50 text-[10px] font-semibold text-blue-600 ring-1 ring-blue-200/50">
                <MapPin className="w-2.5 h-2.5" />
                {location}
                <button onClick={() => { setLocation(''); setShowLocation(false); }} className="hover:text-blue-800"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
          </div>
        )}

        {/* Textarea — with optional colored background */}
        <div className="px-4 pt-3 pb-1">
          {hasColorBg && isTextOnly ? (
            <div
              className="rounded-xl p-4 min-h-[140px] flex items-center justify-center transition-all"
              style={{ background: activeBg.bg }}
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`What's on your mind, ${firstName}?`}
                rows={3}
                className="w-full resize-none bg-transparent text-center text-[18px] font-semibold leading-relaxed placeholder:opacity-50 outline-none"
                style={{ color: activeBg.text }}
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={showPoll ? 'Ask a question...' : `What's on your mind, ${firstName}?`}
              rows={3}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-brand-text placeholder:text-brand-text/35 outline-none"
            />
          )}
          {charCount > maxChars * 0.8 && (
            <div className="flex justify-end mt-1">
              <span className={`text-[10px] font-mono ${charCount > maxChars ? 'text-red-500' : 'text-brand-text/30'}`}>
                {charCount}/{maxChars}
              </span>
            </div>
          )}
        </div>

        {/* Color picker strip — only for text-only posts */}
        {isTextOnly && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-1.5">
              {SWATCH_COLORS.map((color, idx) => (
                <button
                  key={idx}
                  onClick={() => setBgIndex(idx)}
                  className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 ${bgIndex === idx ? 'border-purple-500 scale-110 shadow-md' : 'border-brand-divider hover:scale-105'}`}
                  style={{
                    background: color === 'transparent'
                      ? 'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 50% / 10px 10px'
                      : color,
                  }}
                  title={idx === 0 ? 'No background' : `Color ${idx}`}
                />
              ))}
              {/* Custom color via native picker */}
              <button
                onClick={() => colorInputRef.current?.click()}
                className={`w-6 h-6 rounded-full border-2 border-dashed border-brand-text/20 flex items-center justify-center hover:border-purple-400 transition-all flex-shrink-0 ${bgIndex >= BG_PRESETS.length ? 'border-purple-500 scale-110' : ''}`}
                title="Custom color"
              >
                <Palette className="w-3 h-3 text-brand-text/40" />
              </button>
              <input
                ref={colorInputRef}
                type="color"
                value={customColor}
                onChange={(e) => {
                  const c = e.target.value;
                  setCustomColor(c);
                  // Compute text color based on luminance
                  const r = parseInt(c.slice(1, 3), 16);
                  const g = parseInt(c.slice(3, 5), 16);
                  const b = parseInt(c.slice(5, 7), 16);
                  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                  const textColor = lum > 0.5 ? '#1a1a2e' : '#ffffff';
                  // Push to end of presets or update
                  if (BG_PRESETS.length <= 14) {
                    BG_PRESETS.push({ bg: c, text: textColor });
                  } else {
                    BG_PRESETS[14] = { bg: c, text: textColor };
                  }
                  setBgIndex(14);
                }}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Media previews — compact grid */}
        {previews.length > 0 && (
          <div className="px-4 pb-2">
            <div className={`grid gap-1.5 ${previews.length === 1 ? 'grid-cols-2' : previews.length <= 4 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {previews.map((url, idx) => (
                <div key={idx} className="relative rounded-lg overflow-hidden aspect-square bg-brand-text/5 ring-1 ring-brand-divider">
                  {files[idx]?.type.startsWith('video') ? (
                    <video src={url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* Add more media button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-brand-text/15 flex items-center justify-center hover:border-purple-400 hover:bg-purple-50/50 transition-all"
              >
                <Plus className="w-5 h-5 text-brand-text/30" />
              </button>
            </div>
          </div>
        )}

        {/* Poll editor */}
        {showPoll && (
          <div className="px-4 pb-2">
            <PollEditor poll={poll} onChange={setPoll} accentColor="#7c3aed" isDarkMode={false} />
          </div>
        )}

        {/* Mood picker */}
        {showMood && (
          <div className="px-4 pb-2">
            <div className="border border-purple-100 rounded-xl p-2 bg-gradient-to-br from-purple-50/50 to-pink-50/50">
              <MoodActivityPicker
                accentColor="#7c3aed"
                isDarkMode={false}
                onSelect={(m) => { setMood(m); setShowMood(false); }}
                onClose={() => setShowMood(false)}
              />
            </div>
          </div>
        )}

        {/* Location input */}
        {showLocation && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 border border-blue-100 rounded-xl px-3 py-2.5 bg-gradient-to-r from-blue-50/50 to-cyan-50/50">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where are you?"
                className="flex-1 bg-transparent text-[12px] text-brand-text placeholder:text-brand-text/40 outline-none"
                autoFocus
              />
              <button onClick={() => setShowLocation(false)} className="text-brand-text/40 hover:text-brand-text">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-xl text-[11px] font-semibold text-rose-600">
            {error}
          </div>
        )}

        </div>{/* end scrollable content area */}

        {/* Footer: toolbar + post button — always visible */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-brand-divider bg-gradient-to-r from-slate-50/50 to-purple-50/30 flex-shrink-0">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 rounded-xl transition-all ${files.length > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-brand-text/40 hover:text-emerald-600 hover:bg-emerald-50'}`}
              title="Add media"
            >
              <Camera className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => { setShowPoll(!showPoll); if (showPoll) setPoll({ options: ['', ''], duration: '1d', allowMultiple: false }); }}
              className={`p-2 rounded-xl transition-all ${showPoll ? 'text-orange-600 bg-orange-50' : 'text-brand-text/40 hover:text-orange-600 hover:bg-orange-50'}`}
              title="Add poll"
            >
              <BarChart3 className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setShowMood(!showMood)}
              className={`p-2 rounded-xl transition-all ${mood ? 'text-amber-600 bg-amber-50' : 'text-brand-text/40 hover:text-amber-600 hover:bg-amber-50'}`}
              title="Mood / Activity"
            >
              <Smile className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setShowLocation(!showLocation)}
              className={`p-2 rounded-xl transition-all ${location ? 'text-blue-600 bg-blue-50' : 'text-brand-text/40 hover:text-blue-600 hover:bg-blue-50'}`}
              title="Location"
            >
              <MapPin className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => {}}
              className="p-2 rounded-xl text-brand-text/40 hover:text-pink-600 hover:bg-pink-50 transition-all"
              title="Tags"
            >
              <Hash className="w-[18px] h-[18px]" />
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canPost || isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-purple-300/30"
            style={{ background: accentGradient }}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
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
