'use client';

import React, { useState } from 'react';
import { useSharePost } from '@/hooks/usePostActions';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Repeat2, Quote, Link2, Send } from 'lucide-react';

interface ShareDialogProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ postId, isOpen, onClose }) => {
  const [quoteText, setQuoteText] = useState('');
  const [selectedType, setSelectedType] = useState<'repost' | 'quote' | 'external' | null>(null);
  const [error, setError] = useState('');
  const shareMutation = useSharePost();

  const handleShare = async (type: 'repost' | 'quote' | 'external') => {
    if (type === 'external') {
      const url = `${window.location.origin}/post/${postId}`;
      await navigator.clipboard.writeText(url);
      shareMutation.mutate(
        { postId, shareType: 'external' },
        {
          onSuccess: () => onClose(),
          onError: (err: any) => {
            const msg = err?.response?.data?.error?.message || 'Failed to share';
            setError(msg);
          },
        }
      );
      return;
    }

    if (type === 'repost') {
      shareMutation.mutate(
        { postId, shareType: 'repost' },
        {
          onSuccess: () => onClose(),
          onError: (err: any) => {
            const code = err?.response?.data?.error?.code;
            if (code === 'ALREADY_SHARED') {
              setError('You already reposted this');
            } else if (code === 'CIRCLE_SHARE_RESTRICTED') {
              setError('This post cannot be shared');
            } else {
              setError('Failed to share');
            }
          },
        }
      );
      return;
    }

    // Quote share requires text
    setSelectedType('quote');
  };

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteText.trim()) return;
    shareMutation.mutate(
      { postId, shareType: 'quote', quoteText: quoteText.trim() },
      {
        onSuccess: () => {
          setQuoteText('');
          setSelectedType(null);
          onClose();
        },
        onError: (err: any) => {
          const code = err?.response?.data?.error?.code;
          if (code === 'CIRCLE_SHARE_RESTRICTED') {
            setError('This post cannot be shared');
          } else {
            setError('Failed to share');
          }
        },
      }
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Share Post</h3>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-3 px-3 py-2 bg-rose-50 rounded-xl text-[11px] font-bold text-rose-600">
              {error}
            </div>
          )}

          {/* Options */}
          {selectedType !== 'quote' ? (
            <div className="p-4 space-y-2">
              <button
                onClick={() => handleShare('repost')}
                disabled={shareMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-slate-50 transition-colors text-left group/item"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Repeat2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Repost</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Share to your followers</p>
                </div>
              </button>

              <button
                onClick={() => handleShare('quote')}
                disabled={shareMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-slate-50 transition-colors text-left group/item"
              >
                <div className="w-10 h-10 rounded-xl bg-[#D8103F]/5 flex items-center justify-center text-[#D8103F]">
                  <Quote className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Quote</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Add your thoughts</p>
                </div>
              </button>

              <button
                onClick={() => handleShare('external')}
                disabled={shareMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-slate-50 transition-colors text-left group/item"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Copy Link</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Copy link to clipboard</p>
                </div>
              </button>
            </div>
          ) : (
            /* Quote text input */
            <form onSubmit={handleQuoteSubmit} className="p-4 space-y-3">
              <textarea
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="Add your thoughts..."
                rows={3}
                maxLength={500}
                className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm text-slate-800 border border-slate-100 outline-none focus:border-[#D8103F]/30 resize-none placeholder:text-slate-400"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!quoteText.trim() || shareMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#D8103F] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#b80d35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Share
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ShareDialog;
