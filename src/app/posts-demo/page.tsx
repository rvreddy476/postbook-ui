'use client';

import React from 'react';
import PostCard from '@/components/PostCard';
import type { PostDetail } from '@/types/profile';

const MOCK_POSTS: PostDetail[] = [
    {
        id: '1',
        author_id: 'user1',
        text: 'A beautiful sunset at the beach. Nothing beats this view! 🌅',
        visibility: 'public',
        content_type: 'post',
        is_pinned: false,
        feeling: 'Peaceful',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        media: [
            { media_id: 'sunset1', kind: 'image' }
        ],
        counts: { likes: 124, comments: 18 }
    },
    {
        id: '2',
        author_id: 'user1',
        text: 'Check out the new gallery! 📸✨',
        visibility: 'public',
        content_type: 'post',
        is_pinned: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        media: [
            { media_id: 'img1', kind: 'image' },
            { media_id: 'img2', kind: 'image' },
            { media_id: 'img3', kind: 'image' }
        ],
        counts: { likes: 85, comments: 12 }
    },
    {
        id: '3',
        author_id: 'user1',
        text: 'Learning how to code with AI is crazy! 🤖💻',
        visibility: 'public',
        content_type: 'post',
        is_pinned: false,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
        counts: { likes: 256, comments: 45 }
    },
    {
        id: '4',
        author_id: 'user1',
        text: 'New Reel alert! 🎬🔥 #vibes',
        visibility: 'public',
        content_type: 'short',
        is_pinned: false,
        activity: 'Original Mix - DJ Orbit',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        media: [
            { media_id: 'reel1', kind: 'video' }
        ],
        counts: { likes: 1200, comments: 89 }
    },
    {
        id: '5',
        author_id: 'user1',
        text: 'Morning workout done! 💪🏋️‍♂️',
        visibility: 'public',
        content_type: 'post',
        is_pinned: false,
        feeling: 'Energized',
        activity: 'Workout Mix',
        created_at: new Date(Date.now() - 43200000).toISOString(),
        updated_at: new Date(Date.now() - 43200000).toISOString(),
        media: [
            { media_id: 'workout1', kind: 'image' }
        ],
        counts: { likes: 56, comments: 4 }
    }
];

export default function PostsDemo() {
    return (
        <div className="min-h-screen bg-brand-secondary py-20 px-4 sm:px-0">
            <div className="max-w-[640px] mx-auto space-y-12">
                <header className="text-center space-y-4 mb-20 px-8">
                    <h1 className="text-5xl font-black italic tracking-tighter orchid-text-gradient">Post Design Showreel</h1>
                    <p className="text-brand-highlight font-bold uppercase tracking-[0.4em] text-[10px]">Testing Multi-Content Architecture</p>
                </header>

                <div className="space-y-10">
                    {MOCK_POSTS.map(post => (
                        <div key={post.id} className="space-y-4">
                            <div className="flex items-center gap-4 px-4">
                                <div className="h-px bg-slate-200 flex-1"></div>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">{post.content_type === 'short' ? 'Reel View' : post.media ? 'Media View' : 'Quote View'}</span>
                                <div className="h-px bg-slate-200 flex-1"></div>
                            </div>
                            <PostCard
                                post={post}
                            />
                        </div>
                    ))}
                </div>

                <footer className="text-center py-20 border-t border-brand-divider">
                    <p className="text-brand-text/60 font-bold italic">End of Showcase</p>
                </footer>
            </div>
        </div>
    );
}
