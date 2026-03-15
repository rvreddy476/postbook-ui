'use client';

import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useMyProfile } from '@/hooks/useEditProfile';
import { useFriends } from '@/hooks/useConnections';
import { useStoriesFeed } from '@/hooks/useStories';
import type { Story } from '@/types/profile';
import StoryCreator from '@/components/StoryCreator';
import StoryViewer from '@/components/StoryViewer';

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

interface StoryGroup {
  authorId: string;
  authorName: string;
  authorAvatar: string;
  stories: Story[];
}

const StoriesRow: React.FC<StoriesRowProps> = ({ onCreateClick }) => {
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  const { data: profile } = useMyProfile();
  const { data: friendsData } = useFriends(profile?.id, 20);

  const friends = friendsData?.items ?? [];

  // Collect friend user IDs to fetch their stories
  const followedIds = useMemo(
    () => friends.map((f) => f.user_id),
    [friends]
  );

  const { data: storiesRaw } = useStoriesFeed(followedIds);
  const allStories: Story[] = storiesRaw ?? [];

  // Build a lookup from user_id -> ConnectionUser for avatar/name resolution
  const friendMap = useMemo(
    () => new Map(friends.map((f) => [f.user_id, f])),
    [friends]
  );

  // Group stories by author_id, preserving friend order
  const storyGroups: StoryGroup[] = useMemo(() => {
    // Collect stories per author
    const grouped = new Map<string, Story[]>();
    for (const story of allStories) {
      const existing = grouped.get(story.author_id) ?? [];
      existing.push(story);
      grouped.set(story.author_id, existing);
    }

    // Build groups in friend list order so the row order is deterministic
    const groups: StoryGroup[] = [];
    for (const friend of friends) {
      const stories = grouped.get(friend.user_id);
      if (!stories || stories.length === 0) continue;

      const avatar = friend.avatar_media_id
        ? `/v1/media/${friend.avatar_media_id}/serve`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.user_id}`;

      groups.push({
        authorId: friend.user_id,
        authorName: friend.display_name,
        authorAvatar: avatar,
        stories,
      });
    }

    return groups;
  }, [allStories, friends]);

  // An author has "unviewed" stories when at least one story has zero views
  // (best approximation without per-viewer viewed state in the Story type)
  const hasUnviewed = (group: StoryGroup) =>
    group.stories.some((s) => s.view_count === 0);

  const myAvatar = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.id ?? 'me'}`;

  const handleFriendClick = (groupIndex: number) => {
    setSelectedGroupIndex(groupIndex);
    setStoryViewerOpen(true);
  };

  const handleCreateClick = () => {
    setStoryCreatorOpen(true);
    onCreateClick?.();
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {/* Create Story */}
          <button
            onClick={handleCreateClick}
            className="flex flex-col items-center gap-1 flex-shrink-0 group"
          >
            <div className="relative">
              <div className="w-[48px] h-[48px] rounded-full overflow-hidden ring-2 ring-gray-200 group-hover:ring-blue-300 transition-all">
                <img src={myAvatar} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                <Plus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </div>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold w-14 text-center truncate">
              Your story
            </span>
          </button>

          {/* Friend Stories — only show friends who have active stories */}
          {storyGroups.map((group, index) => {
            const ringColor = RING_COLORS[index % RING_COLORS.length];
            const unviewed = hasUnviewed(group);

            return (
              <button
                key={group.authorId}
                onClick={() => handleFriendClick(index)}
                className="flex flex-col items-center gap-1 flex-shrink-0 group"
              >
                <div
                  className={[
                    'w-[48px] h-[48px] rounded-full overflow-hidden ring-[2.5px] ring-offset-1 group-hover:scale-105 transition-all duration-200',
                    ringColor,
                    unviewed ? 'animate-pulse' : 'opacity-70',
                  ].join(' ')}
                >
                  <img
                    src={group.authorAvatar}
                    alt={group.authorName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[10px] text-gray-500 font-medium w-14 text-center truncate">
                  {group.authorName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story Creator modal */}
      <StoryCreator
        isOpen={storyCreatorOpen}
        onClose={() => setStoryCreatorOpen(false)}
      />

      {/* Story Viewer modal */}
      {storyViewerOpen && storyGroups.length > 0 && (
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={selectedGroupIndex}
          currentUserId={profile?.id}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}
    </>
  );
};

export default StoriesRow;
