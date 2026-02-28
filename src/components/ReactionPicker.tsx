'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const REACTIONS = [
    { type: 'like', emoji: '👍', label: 'Like' },
    { type: 'love', emoji: '❤️', label: 'Love' },
    { type: 'haha', emoji: '😂', label: 'Haha' },
    { type: 'wow', emoji: '😮', label: 'Wow' },
    { type: 'sad', emoji: '😢', label: 'Sad' },
    { type: 'angry', emoji: '😡', label: 'Angry' },
] as const;

interface ReactionPickerProps {
    currentReaction?: string | null;
    onReact: (reactionType: string) => void;
    disabled?: boolean;
    compact?: boolean;
}

const ReactionPicker: React.FC<ReactionPickerProps> = ({ currentReaction, onReact, disabled, compact }) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsOpen(true), 500);
    };

    const handleMouseLeave = () => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsOpen(false), 300);
    };

    const handleClick = () => {
        // Quick tap = toggle like
        onReact(currentReaction ? currentReaction : 'like');
    };

    const handleReactionSelect = (type: string) => {
        onReact(type);
        setIsOpen(false);
    };

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    const activeReaction = REACTIONS.find(r => r.type === currentReaction);

    return (
        <div
            ref={containerRef}
            className="relative inline-flex"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Trigger button */}
            <button
                onClick={handleClick}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeReaction
                        ? 'bg-rose-50 text-rose-600'
                        : 'text-gray-500 hover:bg-gray-100'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className="text-base leading-none">
                    {activeReaction ? activeReaction.emoji : '👍'}
                </span>
                {!compact && (
                    <span>{activeReaction ? activeReaction.label : 'Like'}</span>
                )}
            </button>

            {/* Picker popup */}
            <AnimatePresence>
                {isOpen && !disabled && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 8 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="absolute bottom-full left-0 mb-2 bg-white rounded-full shadow-lg border border-gray-100 px-2 py-1.5 flex gap-0.5 z-50"
                    >
                        {REACTIONS.map((reaction) => (
                            <motion.button
                                key={reaction.type}
                                whileHover={{ scale: 1.4, y: -4 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleReactionSelect(reaction.type)}
                                className={`w-9 h-9 flex items-center justify-center rounded-full text-xl transition-colors ${
                                    currentReaction === reaction.type ? 'bg-blue-50' : 'hover:bg-gray-50'
                                }`}
                                title={reaction.label}
                            >
                                {reaction.emoji}
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReactionPicker;
