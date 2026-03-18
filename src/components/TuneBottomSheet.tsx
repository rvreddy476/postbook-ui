'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface TuneBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  authorUsername?: string;
  onTune: (reason: string) => void;
}

const TUNE_OPTIONS = [
  { id: 'not_interested', label: 'Not interested in this post' },
  { id: 'too_many', label: 'Too many posts from @{username}' },
  { id: 'hide_topic', label: 'Hide this topic' },
  { id: 'misleading', label: 'This content feels misleading' },
];

export default function TuneBottomSheet({ isOpen, onClose, authorUsername, onTune }: TuneBottomSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selected) {
      onTune(selected);
      setSelected(null);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[200]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[201] bg-brand-card rounded-t-2xl shadow-xl max-w-lg mx-auto"
          >
            {/* Handle + Close */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="w-10 h-1 rounded-full bg-brand-text/10 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <h3 className="text-sm font-bold text-brand-text">Tune your feed</h3>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-brand-secondary transition-colors text-brand-text/40 hover:text-brand-text">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options */}
            <div className="px-5 py-3 space-y-2">
              {TUNE_OPTIONS.map((option) => {
                const label = option.label.replace('{username}', authorUsername || 'this user');
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelected(option.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                      selected === option.id
                        ? 'border-brand-text bg-brand-text/5 text-brand-text font-semibold'
                        : 'border-brand-divider text-brand-text/70 hover:border-brand-text/30'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Submit */}
            <div className="px-5 pb-6 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!selected}
                className="w-full py-3 bg-brand-text text-brand-bg rounded-xl text-sm font-bold transition-opacity disabled:opacity-30"
              >
                Tune Feed
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
