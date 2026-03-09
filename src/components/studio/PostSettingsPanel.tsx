'use client';

import React from 'react';
import { MessageCircleOff, HeartOff, Pin } from 'lucide-react';

interface PostSettingsPanelProps {
  noComments: boolean;
  noLikes: boolean;
  pinned: boolean;
  onToggleComments: () => void;
  onToggleLikes: () => void;
  onTogglePinned: () => void;
  accentColor: string;
  isDarkMode?: boolean;
}

const SETTINGS = [
  { key: 'noComments', label: 'No comments', icon: MessageCircleOff },
  { key: 'noLikes', label: 'Hide likes', icon: HeartOff },
  { key: 'pinned', label: 'Pin to profile', icon: Pin },
] as const;

const PostSettingsPanel: React.FC<PostSettingsPanelProps> = ({
  noComments, noLikes, pinned,
  onToggleComments, onToggleLikes, onTogglePinned,
  accentColor,
  isDarkMode = false,
}) => {
  const states: Record<string, boolean> = { noComments, noLikes, pinned };
  const togglers: Record<string, () => void> = {
    noComments: onToggleComments,
    noLikes: onToggleLikes,
    pinned: onTogglePinned,
  };

  return (
    <div className="grid grid-cols-3 gap-2 animate-fadeIn">
      {SETTINGS.map((s) => {
        const on = states[s.key];
        const Icon = s.icon;
        return (
          <button
            key={s.key}
            onClick={togglers[s.key]}
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-all duration-300 text-left"
            style={{
              background: on ? `${accentColor}1F` : (isDarkMode ? '#10182D' : '#F8FAFC'),
              borderColor: on ? `${accentColor}50` : (isDarkMode ? 'rgba(148,163,184,0.2)' : '#E2E8F0'),
            }}
          >
            <Icon
              className="w-4 h-4 shrink-0"
              style={{ color: on ? accentColor : (isDarkMode ? '#94A3B8' : '#64748B') }}
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-[10px] font-semibold truncate"
                style={{ color: on ? (isDarkMode ? '#F8FAFC' : '#0F172A') : (isDarkMode ? '#CBD5E1' : '#334155') }}
              >
                {s.label}
              </p>
            </div>
            <div
              className="w-7 h-4 rounded-full flex items-center transition-all duration-300 px-[2px] shrink-0"
              style={{
                background: on ? accentColor : (isDarkMode ? '#334155' : '#CBD5E1'),
                justifyContent: on ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                className="w-3 h-3 rounded-full transition-all"
                style={{ background: '#fff' }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default PostSettingsPanel;
