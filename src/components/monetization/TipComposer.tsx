"use client";

import React, { useState } from "react";
import { useSendTip } from "@/hooks/useMonetization";

interface TipComposerProps {
  creatorId: string;
  creatorName?: string;
  postId?: string | null;
  open: boolean;
  onClose: () => void;
  onSent?: (amountPaise: number) => void;
}

// Quick-select chips so most fans don't have to type. Values are in
// paise; backend caps at 5,000 INR per tip (500_000 paise).
const QUICK_AMOUNTS = [
  { label: "₹10", paise: 1000 },
  { label: "₹50", paise: 5000 },
  { label: "₹100", paise: 10000 },
  { label: "₹500", paise: 50000 },
];

const MIN_PAISE = 100; // ₹1
const MAX_PAISE = 500_000; // ₹5,000
const MESSAGE_MAX = 250;

const TipComposer: React.FC<TipComposerProps> = ({
  creatorId,
  creatorName,
  postId,
  open,
  onClose,
  onSent,
}) => {
  const [amountPaise, setAmountPaise] = useState<number>(5000);
  const [customRupees, setCustomRupees] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const sendTip = useSendTip();

  if (!open) return null;

  const effectivePaise = customRupees
    ? Math.round(Number(customRupees) * 100) || 0
    : amountPaise;

  const validate = (): string | null => {
    if (effectivePaise < MIN_PAISE) return "Minimum tip is ₹1";
    if (effectivePaise > MAX_PAISE) return "Maximum tip is ₹5,000";
    if (message.length > MESSAGE_MAX) return `Message must be under ${MESSAGE_MAX} characters`;
    return null;
  };

  const handleSend = async () => {
    setErrMsg(null);
    const v = validate();
    if (v) {
      setErrMsg(v);
      return;
    }
    sendTip.mutate(
      {
        recipientId: creatorId,
        amountPaise: effectivePaise,
        message: message.trim() || undefined,
        postId: postId ?? null,
      },
      {
        onSuccess: () => {
          onSent?.(effectivePaise);
          // Reset for next tip.
          setMessage("");
          setCustomRupees("");
          setAmountPaise(5000);
          onClose();
        },
        onError: (err: unknown) => {
          // Axios error: read backend error.message if present.
          const e = err as { response?: { data?: { error?: { message?: string; code?: string } }; status?: number } };
          const code = e.response?.data?.error?.code;
          const msg = e.response?.data?.error?.message;
          if (code === "DAILY_TIP_CAP_EXCEEDED") {
            setErrMsg("You've hit the ₹20,000 daily tip limit for this creator. Try again tomorrow.");
          } else if (code === "CHARGE_FAILED") {
            setErrMsg("Wallet charge failed. Top up your wallet and try again.");
          } else {
            setErrMsg(msg || "Failed to send tip");
          }
        },
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Send a tip</h2>
            <p className="text-sm text-zinc-500 mt-1">
              {creatorName ? `to ${creatorName}` : "Support this creator"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {QUICK_AMOUNTS.map((q) => {
            const isActive = !customRupees && amountPaise === q.paise;
            return (
              <button
                key={q.paise}
                onClick={() => {
                  setAmountPaise(q.paise);
                  setCustomRupees("");
                }}
                className={
                  "py-2 rounded-lg border text-sm font-medium transition " +
                  (isActive
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700")
                }
              >
                {q.label}
              </button>
            );
          })}
        </div>

        <label className="block text-xs text-zinc-500 mb-1">Custom amount (₹)</label>
        <input
          type="number"
          inputMode="decimal"
          value={customRupees}
          onChange={(e) => setCustomRupees(e.target.value)}
          placeholder="e.g. 250"
          min={1}
          max={5000}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 mb-3"
        />

        <label className="block text-xs text-zinc-500 mb-1">
          Message <span className="text-zinc-400">({message.length}/{MESSAGE_MAX})</span>
        </label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          placeholder="Say something nice (optional)"
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 resize-none"
        />

        {errMsg && (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">{errMsg}</div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            Total: <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              ₹{(effectivePaise / 100).toFixed(2)}
            </span>
          </div>
          <button
            disabled={sendTip.isPending}
            onClick={handleSend}
            className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
          >
            {sendTip.isPending ? "Sending..." : "Send tip"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TipComposer;
