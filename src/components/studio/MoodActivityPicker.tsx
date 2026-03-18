'use client';

import React, { useState, lazy, Suspense } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import data from '@emoji-mart/data';

const EmojiPicker = lazy(() => import('@emoji-mart/react'));

interface Activity {
  emoji: string;
  label: string;
  placeholder: string;
}

const ACTIVITIES: Activity[] = [
  { emoji: '\uD83C\uDFB5', label: 'Listening to', placeholder: 'artist or song...' },
  { emoji: '\uD83D\uDCFA', label: 'Watching', placeholder: 'show or movie...' },
  { emoji: '\uD83C\uDFAE', label: 'Playing', placeholder: 'game name...' },
  { emoji: '\uD83D\uDCD6', label: 'Reading', placeholder: 'book title...' },
  { emoji: '\u2708\uFE0F', label: 'Travelling to', placeholder: 'where to...' },
  { emoji: '\uD83C\uDF7D\uFE0F', label: 'Eating at', placeholder: 'restaurant...' },
  { emoji: '\uD83D\uDCBC', label: 'Working on', placeholder: 'project...' },
  { emoji: '\uD83C\uDFA8', label: 'Creating', placeholder: 'what...' },
];

interface MoodActivityPickerProps {
  onSelect: (mood: string) => void;
  onClose: () => void;
  accentColor: string;
  isDarkMode?: boolean;
}

const MoodActivityPicker: React.FC<MoodActivityPickerProps> = ({ onSelect, onClose, accentColor, isDarkMode = false }) => {
  const [tab, setTab] = useState<'feeling' | 'activity'>('feeling');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activityDetail, setActivityDetail] = useState('');

  const handleEmojiSelect = (emoji: { native: string; name: string }) => {
    onSelect(`${emoji.native} ${emoji.name}`);
  };

  const handleActivityDone = () => {
    if (selectedActivity && activityDetail.trim()) {
      onSelect(`${selectedActivity.emoji} ${selectedActivity.label} ${activityDetail}`);
    }
  };

  return (
    <div className={`rounded-xl border overflow-hidden animate-fadeIn ${isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-brand-card border-brand-divider'}`}>
      {/* Tabs */}
      <div className={`flex border-b ${isDarkMode ? 'border-white/10' : 'border-brand-divider'}`}>
        {(['feeling', 'activity'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedActivity(null); setActivityDetail(''); }}
            className="flex-1 py-2.5 text-[11px] font-semibold transition-all border-b-2 capitalize"
            style={{
              borderColor: tab === t ? accentColor : 'transparent',
              color: tab === t ? accentColor : '#94A3B8',
            }}
          >
            {t}
          </button>
        ))}
        <button onClick={onClose} className={`px-3 text-brand-text/60 transition-colors ${isDarkMode ? 'hover:text-brand-secondary' : 'hover:text-brand-text'}`}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {tab === 'feeling' ? (
          <Suspense fallback={<div className="h-[300px] flex items-center justify-center text-sm text-brand-text/60">Loading...</div>}>
            <EmojiPicker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme={isDarkMode ? 'dark' : 'light'}
              previewPosition="none"
              skinTonePosition="none"
              perLine={8}
              maxFrequentRows={2}
            />
          </Suspense>
        ) : selectedActivity ? (
          <div className="p-1 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectedActivity(null); setActivityDetail(''); }}
                className={`text-brand-text/60 transition-colors ${isDarkMode ? 'hover:text-slate-100' : 'hover:text-brand-text'}`}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className={`text-sm ${isDarkMode ? 'text-slate-100' : 'text-brand-text'}`}>
                {selectedActivity.emoji} {selectedActivity.label}
              </span>
            </div>
            <input
              value={activityDetail}
              onChange={(e) => setActivityDetail(e.target.value)}
              placeholder={selectedActivity.placeholder}
              autoFocus
              className={`w-full rounded-xl px-3 py-2.5 text-[13px] ${isDarkMode ? 'placeholder:text-brand-highlight' : 'placeholder:text-brand-text/60'} focus:outline-none focus:ring-1`}
              style={{
                background: isDarkMode ? '#10182D' : '#F8FAFC',
                border: isDarkMode ? '1px solid rgba(148,163,184,0.2)' : '1px solid #E2E8F0',
                color: isDarkMode ? '#E2E8F0' : '#0F172A',
                '--tw-ring-color': `${accentColor}30`,
              } as React.CSSProperties}
            />
            <button
              onClick={handleActivityDone}
              disabled={!activityDetail.trim()}
              className="w-full py-2 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-40 text-white"
              style={{
                background: activityDetail.trim() ? accentColor : '#D4C4B0',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 max-h-[200px] overflow-y-auto scrollbar-hide">
            {ACTIVITIES.map((a) => (
              <button
                key={a.label}
                onClick={() => setSelectedActivity(a)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${isDarkMode ? 'hover:bg-brand-card/10' : 'hover:bg-blue-50'}`}
              >
                <span className="text-base">{a.emoji}</span>
                <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-100' : 'text-brand-text'}`}>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MoodActivityPicker;
