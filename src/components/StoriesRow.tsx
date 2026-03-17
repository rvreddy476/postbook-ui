'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMyProfile } from '@/hooks/useEditProfile';
import { useFriends } from '@/hooks/useConnections';
import { useStoriesFeed } from '@/hooks/useStories';
import type { Story } from '@/types/profile';
import StoryCreator from '@/components/StoryCreator';
import StoryViewer from '@/components/StoryViewer';

interface StoriesRowProps {
  onCreateClick?: () => void;
}

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useMyProfile();
  const { data: friendsData } = useFriends(profile?.id, 20);

  const friends = friendsData?.items ?? [];

  const followedIds = useMemo(
    () => friends.map((f) => f.user_id),
    [friends]
  );

  const { data: storiesRaw } = useStoriesFeed(followedIds);
  const allStories: Story[] = storiesRaw ?? [];

  const storyGroups: StoryGroup[] = useMemo(() => {
    const grouped = new Map<string, Story[]>();
    for (const story of allStories) {
      const existing = grouped.get(story.author_id) ?? [];
      existing.push(story);
      grouped.set(story.author_id, existing);
    }

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

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth / 2 : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-display font-black tracking-tighter text-brand-text">LATEST STORIES</h2>
            <div className="h-px w-24 bg-brand-divider" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-full border border-brand-divider text-brand-text/60 hover:text-brand-accent hover:border-brand-accent transition-all"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-full border border-brand-divider text-brand-text/60 hover:text-brand-accent hover:border-brand-accent transition-all"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto no-scrollbar scrollbar-hide pb-2"
        >
          {/* Add Story Card */}
          <div className="flex-shrink-0 cursor-pointer group" onClick={handleCreateClick}>
            <div className="relative w-24 h-36 rounded-2xl overflow-hidden border border-dashed border-brand-divider bg-brand-card transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(48,47,44,0.1)] group-hover:border-brand-accent/50">
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 group-hover:bg-brand-accent/10 transition-colors">
                <div className="w-8 h-8 rounded-full bg-brand-accent text-brand-bg flex items-center justify-center shadow-lg">
                  <Plus size={18} />
                </div>
                <span className="text-[10px] font-black tracking-widest uppercase text-brand-accent">Add</span>
              </div>
            </div>
          </div>

          {/* Story Cards */}
          {storyGroups.map((group, index) => {
            const unviewed = hasUnviewed(group);

            return (
              <div
                key={group.authorId}
                className="flex-shrink-0 cursor-pointer group"
                onClick={() => handleFriendClick(index)}
              >
                <div className={`relative w-24 h-36 rounded-2xl overflow-hidden border transition-all duration-500
                  ${unviewed ? 'border-brand-accent shadow-lg shadow-brand-accent/20' : 'border-brand-divider'}
                  group-hover:shadow-[0_0_20px_rgba(48,47,44,0.1)] group-hover:border-brand-accent/50`}>
                  <img
                    src={group.authorAvatar}
                    alt={group.authorName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                  {/* Avatar top-left */}
                  <div className="absolute top-2 left-2 w-8 h-8 rounded-full border-2 border-brand-accent overflow-hidden shadow-lg z-10">
                    <img src={group.authorAvatar} alt={group.authorName} className="w-full h-full object-cover" />
                  </div>

                  {/* Name bottom */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest truncate drop-shadow-md">{group.authorName}</p>
                  </div>

                  {/* Unseen dot */}
                  {unviewed && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-brand-accent rounded-full shadow-[0_0_10px_#b6a6ca] z-10" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-px w-full bg-brand-divider/50" />
      </section>

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
