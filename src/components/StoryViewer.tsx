'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Pause, Play, Trash2 } from 'lucide-react';
import { useViewStory, useDeleteStory } from '@/hooks/useStories';
import type { Story } from '@/types/profile';

interface StoryGroup {
    authorId: string;
    authorName: string;
    authorAvatar: string;
    stories: Story[];
}

interface StoryViewerProps {
    storyGroups: StoryGroup[];
    initialGroupIndex?: number;
    currentUserId?: string;
    onClose: () => void;
}

const STORY_DURATION = 5000; // 5 seconds per story

const StoryViewer: React.FC<StoryViewerProps> = ({
    storyGroups,
    initialGroupIndex = 0,
    currentUserId,
    onClose,
}) => {
    const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();

    const viewStory = useViewStory();
    const deleteStory = useDeleteStory();

    const currentGroup = storyGroups[groupIndex];
    const currentStory = currentGroup?.stories[storyIndex];
    const isOwnStory = currentUserId === currentGroup?.authorId;

    // Mark story as viewed
    useEffect(() => {
        if (currentStory) {
            viewStory.mutate(currentStory.id);
        }
    }, [currentStory?.id]);

    // Progress timer
    useEffect(() => {
        if (isPaused || !currentStory) return;

        const tick = 50;
        setProgress(0);
        intervalRef.current = setInterval(() => {
            setProgress(prev => {
                const next = prev + (tick / STORY_DURATION) * 100;
                if (next >= 100) {
                    goNext();
                    return 0;
                }
                return next;
            });
        }, tick);

        return () => clearInterval(intervalRef.current);
    }, [groupIndex, storyIndex, isPaused]);

    const goNext = useCallback(() => {
        if (!currentGroup) return;
        if (storyIndex < currentGroup.stories.length - 1) {
            setStoryIndex(s => s + 1);
        } else if (groupIndex < storyGroups.length - 1) {
            setGroupIndex(g => g + 1);
            setStoryIndex(0);
        } else {
            onClose();
        }
    }, [storyIndex, groupIndex, currentGroup, storyGroups.length, onClose]);

    const goPrev = useCallback(() => {
        if (storyIndex > 0) {
            setStoryIndex(s => s - 1);
        } else if (groupIndex > 0) {
            setGroupIndex(g => g - 1);
            setStoryIndex(storyGroups[groupIndex - 1].stories.length - 1);
        }
    }, [storyIndex, groupIndex, storyGroups]);

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goNext();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'Escape') onClose();
            else if (e.key === ' ') { e.preventDefault(); setIsPaused(p => !p); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [goNext, goPrev, onClose]);

    if (!currentGroup || !currentStory) return null;

    const handleDelete = () => {
        deleteStory.mutate(currentStory.id, { onSuccess: goNext });
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            >
                {/* Close button */}
                <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white z-50">
                    <X className="w-7 h-7" />
                </button>

                {/* Navigation arrows */}
                {(groupIndex > 0 || storyIndex > 0) && (
                    <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                        <ChevronLeft className="w-10 h-10" />
                    </button>
                )}
                {(groupIndex < storyGroups.length - 1 || storyIndex < currentGroup.stories.length - 1) && (
                    <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                        <ChevronRight className="w-10 h-10" />
                    </button>
                )}

                {/* Story content */}
                <div className="relative w-full max-w-[420px] aspect-[9/16] rounded-2xl overflow-hidden bg-gray-900">
                    {/* Progress bars */}
                    <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
                        {currentGroup.stories.map((_, idx) => (
                            <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white rounded-full transition-all duration-75"
                                    style={{
                                        width: idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%',
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Author header */}
                    <div className="absolute top-6 left-3 right-3 z-10 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/50">
                            <img src={currentGroup.authorAvatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-white text-sm font-semibold">{currentGroup.authorName}</span>
                        <span className="text-white/50 text-xs">
                            {new Date(currentStory.created_at).toLocaleDateString()}
                        </span>
                        <div className="ml-auto flex gap-2">
                            <button onClick={() => setIsPaused(p => !p)} className="text-white/70 hover:text-white">
                                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                            </button>
                            {isOwnStory && (
                                <button onClick={handleDelete} className="text-white/70 hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Media */}
                    {currentStory.media_type === 'video' ? (
                        <video
                            key={currentStory.id}
                            src={currentStory.media_url}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <img
                            key={currentStory.id}
                            src={currentStory.media_url}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    )}

                    {/* Caption */}
                    {currentStory.caption && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                            <p className="text-white text-sm">{currentStory.caption}</p>
                        </div>
                    )}

                    {/* Tap zones */}
                    <div className="absolute inset-0 flex">
                        <div className="w-1/3" onClick={goPrev} />
                        <div className="w-1/3" onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)} />
                        <div className="w-1/3" onClick={goNext} />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default StoryViewer;
