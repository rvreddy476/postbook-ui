'use client';

import React from 'react';
import { useMyProfile } from '@/hooks/useEditProfile';
import { Video, Image, Smile } from 'lucide-react';

interface ComposeBarProps {
  onCreateClick?: () => void;
}

const ComposeBar: React.FC<ComposeBarProps> = ({ onCreateClick }) => {
  const { data: profile } = useMyProfile();

  const avatar = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.id ?? 'me'}`;

  return (
    <div className="bg-brand-card rounded-lg shadow-sm border border-brand-divider">
      {/* Main compose row */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        </div>
        <button
          onClick={onCreateClick}
          className="flex-1 text-left px-4 py-2.5 bg-brand-divider hover:bg-brand-divider rounded-full text-brand-text/60 text-sm transition-colors"
        >
          What's on your mind?
        </button>
      </div>

      {/* Quick action row */}
      <div className="flex items-center border-t border-brand-divider">
        <button
          onClick={onCreateClick}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-brand-secondary transition-colors rounded-bl-lg"
        >
          <Video className="w-5 h-5 text-red-500" />
          <span className="text-sm font-medium text-brand-text/80">Live video</span>
        </button>
        <div className="w-px h-6 bg-brand-divider" />
        <button
          onClick={onCreateClick}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-brand-secondary transition-colors"
        >
          <Image className="w-5 h-5 text-green-500" />
          <span className="text-sm font-medium text-brand-text/80">Photo/video</span>
        </button>
        <div className="w-px h-6 bg-brand-divider" />
        <button
          onClick={onCreateClick}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-brand-secondary transition-colors rounded-br-lg"
        >
          <Smile className="w-5 h-5 text-yellow-500" />
          <span className="text-sm font-medium text-brand-text/80">Feeling</span>
        </button>
      </div>
    </div>
  );
};

export default ComposeBar;
