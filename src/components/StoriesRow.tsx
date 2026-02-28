'use client';

import React from 'react';
import { useMyProfile } from '@/hooks/useEditProfile';
import { useFriends } from '@/hooks/useConnections';
import { Plus } from 'lucide-react';

interface StoriesRowProps {
  onCreateClick?: () => void;
}

const RING_COLORS = [
  'ring-blue-400',
  'ring-pink-400',
  'ring-emerald-400',
  'ring-purple-400',
  'ring-amber-400',
  'ring-cyan-400',
  'ring-rose-400',
  'ring-indigo-400',
];

const StoriesRow: React.FC<StoriesRowProps> = ({ onCreateClick }) => {
  const { data: profile } = useMyProfile();
  const { data: friendsData } = useFriends(profile?.id, 20);

  const myAvatar = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.id ?? 'me'}`;

  const friends = friendsData?.items ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
        {/* Create Story */}
        <button
          onClick={onCreateClick}
          className="flex flex-col items-center gap-2 flex-shrink-0 group"
        >
          <div className="relative">
            <div className="w-[60px] h-[60px] rounded-full overflow-hidden ring-2 ring-gray-200 group-hover:ring-blue-300 transition-all">
              <img src={myAvatar} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center border-[2.5px] border-white shadow-sm">
              <Plus className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          </div>
          <span className="text-[11px] text-gray-500 font-semibold w-16 text-center truncate">
            Your story
          </span>
        </button>

        {/* Friend Stories */}
        {friends.map((friend, index) => {
          const friendAvatar = friend.avatar_media_id
            ? `/v1/media/${friend.avatar_media_id}/serve`
            : `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.user_id}`;

          const ringColor = RING_COLORS[index % RING_COLORS.length];

          return (
            <div
              key={friend.user_id}
              className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group"
            >
              <div className={`w-[60px] h-[60px] rounded-full overflow-hidden ring-[2.5px] ${ringColor} ring-offset-2 group-hover:scale-105 transition-all duration-200`}>
                <img src={friendAvatar} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-[11px] text-gray-500 font-medium w-16 text-center truncate">
                {friend.display_name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StoriesRow;
