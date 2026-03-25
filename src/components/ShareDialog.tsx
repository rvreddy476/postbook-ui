'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSharePost } from '@/hooks/usePostActions';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Repeat2, Quote, Link2, Send } from 'lucide-react';

interface ShareDialogProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  shareUrl?: string;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ postId, isOpen, onClose, shareUrl }) => {
  const [quoteText, setQuoteText] = useState('');
  const [selectedType, setSelectedType] = useState<'repost' | 'quote' | 'external' | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const shareMutation = useSharePost();

  const handleShare = async (type: 'repost' | 'quote' | 'external') => {
    const showSuccessAndClose = (msg: string) => {
      setError('');
      setSuccessMsg(msg);
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1500);
    };

    if (type === 'external') {
      const url = shareUrl || `${window.location.origin}/post/${postId}`;
      await navigator.clipboard.writeText(url);
      shareMutation.mutate(
        { postId, shareType: 'external' },
        {
          onSuccess: () => showSuccessAndClose('Link copied to clipboard!'),
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
          onSuccess: () => showSuccessAndClose('Reposted! It will appear in your followers\' feeds.'),
          onError: (err: any) => {
            const code = err?.response?.data?.error?.code;
            if (code === 'ALREADY_SHARED' || code === 'ALREADY_REPOSTED') {
              setError('You already reposted this');
            } else if (code === 'CIRCLE_SHARE_RESTRICTED' || code === 'NOT_ELIGIBLE') {
              setError('This post cannot be reposted');
            } else {
              setError('Failed to repost');
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
          setError('');
          setSuccessMsg('Quote posted!');
          setTimeout(() => {
            setSuccessMsg('');
            onClose();
          }, 1500);
        },
        onError: (err: any) => {
          const code = err?.response?.data?.error?.code;
          if (code === 'CIRCLE_SHARE_RESTRICTED' || code === 'NOT_ELIGIBLE') {
            setError('This post cannot be reposted');
          } else if (code === 'QUOTE_TEXT_REQUIRED') {
            setError('Add your thoughts to quote repost');
          } else if (code === 'QUOTE_TEXT_TOO_LONG') {
            setError('Quote text must be 500 characters or fewer');
          } else {
            setError('Failed to share');
          }
        },
      }
    );
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
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
            className="bg-brand-card rounded-3xl shadow-2xl border border-brand-divider w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-divider">
            <h3 className="text-sm font-black uppercase tracking-widest text-brand-text">Share Post</h3>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-brand-secondary text-brand-text/60 hover:text-brand-highlight transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Success */}
          {successMsg && (
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-sm font-semibold text-brand-text">{successMsg}</p>
            </div>
          )}

          {/* Error */}
          {!successMsg && error && (
            <div className="mx-6 mt-3 px-3 py-2 bg-rose-50 rounded-xl text-[11px] font-bold text-rose-600">
              {error}
            </div>
          )}

          {/* Options */}
          {successMsg ? null : selectedType !== 'quote' ? (
            <div className="p-4 space-y-2">
              <button
                onClick={() => handleShare('repost')}
                disabled={shareMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-brand-secondary transition-colors text-left group/item"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Repeat2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-brand-text uppercase tracking-widest">Repost</p>
                  <p className="text-[10px] text-brand-text/60 mt-0.5">Share to your followers</p>
                </div>
              </button>

              <button
                onClick={() => handleShare('quote')}
                disabled={shareMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-brand-secondary transition-colors text-left group/item"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-text/5 flex items-center justify-center text-brand-text">
                  <Quote className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-brand-text uppercase tracking-widest">Quote</p>
                  <p className="text-[10px] text-brand-text/60 mt-0.5">Add your thoughts</p>
                </div>
              </button>

              <button
                onClick={() => handleShare('external')}
                disabled={shareMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-brand-secondary transition-colors text-left group/item"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-brand-text uppercase tracking-widest">Copy Link</p>
                  <p className="text-[10px] text-brand-text/60 mt-0.5">Copy link to clipboard</p>
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
                className="w-full bg-brand-secondary rounded-2xl px-4 py-3 text-sm text-brand-text border border-brand-divider outline-none focus:border-brand-text/30 resize-none placeholder:text-brand-text/60"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="text-[10px] font-bold text-brand-highlight hover:text-brand-text uppercase tracking-widest"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!quoteText.trim() || shareMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-text text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-text/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Share
                </button>
              </div>
            </form>
          )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ShareDialog;
