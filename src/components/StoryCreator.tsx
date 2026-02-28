'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Image, Video, Eye } from 'lucide-react';
import { useCreateStory } from '@/hooks/useStories';

interface StoryCreatorProps {
    isOpen: boolean;
    onClose: () => void;
}

const VISIBILITY_OPTIONS = [
    { value: 'public', label: 'Everyone', icon: '🌍' },
    { value: 'followers', label: 'Followers', icon: '👥' },
    { value: 'close_friends', label: 'Close Friends', icon: '⭐' },
] as const;

const StoryCreator: React.FC<StoryCreatorProps> = ({ isOpen, onClose }) => {
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [caption, setCaption] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'followers' | 'close_friends'>('public');
    const [isHighlight, setIsHighlight] = useState(false);
    const [highlightGroup, setHighlightGroup] = useState('');
    const [previewFile, setPreviewFile] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const createStory = useCreateStory();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isVideo = file.type.startsWith('video/');
        setMediaType(isVideo ? 'video' : 'image');
        setPreviewFile(URL.createObjectURL(file));
        // In production, upload via media-service first. For now, set a placeholder URL.
        setMediaUrl(`/uploads/stories/${Date.now()}_${file.name}`);
    };

    const handleSubmit = () => {
        if (!mediaUrl) return;

        createStory.mutate(
            {
                media_url: mediaUrl,
                media_type: mediaType,
                caption: caption || undefined,
                visibility,
                is_highlight: isHighlight,
                highlight_group: highlightGroup || undefined,
            },
            {
                onSuccess: () => {
                    resetForm();
                    onClose();
                },
            }
        );
    };

    const resetForm = () => {
        setMediaUrl('');
        setCaption('');
        setVisibility('public');
        setIsHighlight(false);
        setHighlightGroup('');
        setPreviewFile(null);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">Create Story</h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* File upload / preview */}
                            {previewFile ? (
                                <div className="relative aspect-[9/16] max-h-[300px] rounded-xl overflow-hidden bg-black mx-auto w-fit">
                                    {mediaType === 'video' ? (
                                        <video src={previewFile} className="h-full object-contain" autoPlay muted loop />
                                    ) : (
                                        <img src={previewFile} alt="Preview" className="h-full object-contain" />
                                    )}
                                    <button
                                        onClick={() => { setPreviewFile(null); setMediaUrl(''); }}
                                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    className="w-full aspect-[9/16] max-h-[200px] border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
                                >
                                    <Upload className="w-8 h-8" />
                                    <div className="flex gap-4 text-xs">
                                        <span className="flex items-center gap-1"><Image className="w-3.5 h-3.5" /> Image</span>
                                        <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Video</span>
                                    </div>
                                    <span className="text-sm">Tap to upload</span>
                                </button>
                            )}
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {/* Caption */}
                            <textarea
                                value={caption}
                                onChange={e => setCaption(e.target.value)}
                                placeholder="Add a caption..."
                                maxLength={500}
                                rows={2}
                                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                            />

                            {/* Visibility */}
                            <div className="flex gap-2">
                                {VISIBILITY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setVisibility(opt.value)}
                                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                                            visibility === opt.value
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className="mr-1">{opt.icon}</span> {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Highlight toggle */}
                            <label className="flex items-center gap-3 text-sm text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isHighlight}
                                    onChange={e => setIsHighlight(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-200"
                                />
                                Save as Highlight
                            </label>
                            {isHighlight && (
                                <input
                                    type="text"
                                    value={highlightGroup}
                                    onChange={e => setHighlightGroup(e.target.value)}
                                    placeholder="Highlight group name (optional)"
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!mediaUrl || createStory.isPending}
                                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {createStory.isPending ? 'Sharing...' : 'Share Story'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default StoryCreator;
