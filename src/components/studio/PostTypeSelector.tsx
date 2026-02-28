'use client';

import React from 'react';
import { Type, Camera, Video, FileText, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export interface PostType {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  hint: string;
}

const ACCENT = '#7B5B3A';

export const POST_TYPES: PostType[] = [
  { id: 'text', label: 'Text', icon: <Type className="w-4 h-4" />, color: ACCENT, hint: 'Share a thought' },
  { id: 'photo', label: 'Photo', icon: <Camera className="w-4 h-4" />, color: ACCENT, hint: 'A moment captured' },
  { id: 'video', label: 'Video', icon: <Video className="w-4 h-4" />, color: ACCENT, hint: 'Up to 5 min' },
  { id: 'article', label: 'Article', icon: <FileText className="w-4 h-4" />, color: ACCENT, hint: 'Long-form writing' },
  { id: 'poll', label: 'Poll', icon: <BarChart3 className="w-4 h-4" />, color: ACCENT, hint: 'Let people decide' },
];

interface PostTypeSelectorProps {
  activeType: string;
  onSelect: (typeId: string) => void;
}

const PostTypeSelector: React.FC<PostTypeSelectorProps> = ({ activeType, onSelect }) => {
  return (
    <div className="relative flex" style={{ borderBottom: '1px solid #F0E6DC' }}>
      {POST_TYPES.map((t) => {
        const isActive = activeType === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="relative flex-1 flex items-center justify-center gap-1.5 py-3 transition-colors"
          >
            <span style={{ color: isActive ? ACCENT : '#C4B5A6' }}>{t.icon}</span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: isActive ? ACCENT : '#C4B5A6' }}
            >
              {t.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="postTypeIndicator"
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                style={{ background: ACCENT }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PostTypeSelector;
