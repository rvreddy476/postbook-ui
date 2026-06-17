"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link2, MessageCircle, Send, Mail, Check, Share2, X } from "lucide-react";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

interface ShareTarget {
  label: string;
  icon: ReactNode;
  bg: string;
  href?: string;
  action?: () => void;
}

export function ShareSheet({ open, onClose, url, title = "Check this out on VChat" }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        onClose();
      } catch {
        /* user dismissed */
      }
    }
  };

  const targets: ShareTarget[] = [
    { label: copied ? "Copied!" : "Copy link", icon: copied ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />, bg: "bg-brand-secondary text-brand-text", action: copyLink },
    { label: "WhatsApp", icon: <MessageCircle className="h-5 w-5" />, bg: "bg-emerald-500 text-white", href: `https://wa.me/?text=${encTitle}%20${enc}` },
    { label: "Telegram", icon: <Send className="h-5 w-5" />, bg: "bg-sky-500 text-white", href: `https://t.me/share/url?url=${enc}&text=${encTitle}` },
    { label: "X", icon: <span className="text-[17px] font-black leading-none">𝕏</span>, bg: "bg-black text-white", href: `https://twitter.com/intent/tweet?url=${enc}&text=${encTitle}` },
    { label: "Facebook", icon: <span className="text-[18px] font-black leading-none">f</span>, bg: "bg-[#1877F2] text-white", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
    { label: "Email", icon: <Mail className="h-5 w-5" />, bg: "bg-brand-secondary text-brand-text", href: `mailto:?subject=${encTitle}&body=${enc}` },
  ];

  const hasNative = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[110] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />

          <motion.div
            role="dialog"
            aria-label="Share"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="relative w-full max-w-[480px] rounded-t-2xl border-t border-brand-divider bg-brand-card pb-[max(env(safe-area-inset-bottom),20px)] pt-2 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-text/20" />

            <div className="flex items-center justify-between px-5 pb-1">
              <h3 className="text-[15px] font-bold text-brand-text">Share</h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/50 transition hover:bg-brand-secondary hover:text-brand-text"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Link preview row */}
            <div className="mx-5 mb-4 mt-2 flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-secondary/60 px-3 py-2.5">
              <span className="flex-1 truncate text-[12px] text-brand-text/60">{url}</span>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg bg-brand-text px-3 py-1.5 text-[12px] font-bold text-brand-bg transition hover:opacity-90"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* Targets */}
            <div className="grid grid-cols-4 gap-2 px-4 pb-2 sm:grid-cols-6">
              {targets.map((t) => {
                const inner = (
                  <>
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full ${t.bg}`}>{t.icon}</span>
                    <span className="text-[11px] font-medium text-brand-text/70">{t.label}</span>
                  </>
                );
                return t.href ? (
                  <a
                    key={t.label}
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-2 transition hover:bg-brand-secondary"
                  >
                    {inner}
                  </a>
                ) : (
                  <button
                    key={t.label}
                    type="button"
                    onClick={t.action}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-2 transition hover:bg-brand-secondary"
                  >
                    {inner}
                  </button>
                );
              })}

              {hasNative ? (
                <button
                  type="button"
                  onClick={nativeShare}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-2 transition hover:bg-brand-secondary"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-secondary text-brand-text">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-medium text-brand-text/70">More</span>
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
