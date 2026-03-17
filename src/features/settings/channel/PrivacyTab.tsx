"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { useMyChannels, useUpdateChannel } from "@/hooks/useChannels";

type CommentsMode = "everyone" | "followers" | "none";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-[#D8103F]" : "bg-slate-200"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-brand-card shadow-sm transition-transform ${enabled ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function SettingsRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 pr-4">
        <p className="text-[13px] font-medium text-slate-700">{label}</p>
        {description ? <p className="mt-0.5 text-[11px] text-brand-text/60">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function PrivacyTab() {
  const { data: channels } = useMyChannels();
  const channel = channels?.[0];
  const updateMutation = useUpdateChannel();

  const [commentsMode, setCommentsMode] = useState<CommentsMode>("everyone");
  const [allowRemix, setAllowRemix] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);
  const [contentWarning, setContentWarning] = useState(false);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [saved, setSaved] = useState(false);

  const addBlockedWord = () => {
    const word = newWord.trim().toLowerCase();
    if (!word || blockedWords.includes(word)) return;
    setBlockedWords((prev) => [...prev, word]);
    setNewWord("");
  };

  const removeBlockedWord = (word: string) => {
    setBlockedWords((prev) => prev.filter((w) => w !== word));
  };

  const handleSave = useCallback(async () => {
    if (!channel) return;
    await updateMutation.mutateAsync({ id: channel.id });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [channel, updateMutation]);

  return (
    <div className="space-y-6">
      {/* Comments */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-4 text-[14px] font-bold text-brand-text">Comments</h2>
        <div>
          <label className="mb-2 block text-[12px] font-semibold text-brand-highlight">
            Who can comment on your content
          </label>
          <div className="flex gap-2">
            {(["everyone", "followers", "none"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCommentsMode(mode)}
                className={`rounded-xl px-4 py-2 text-[12px] font-semibold transition-all ${
                  commentsMode === mode
                    ? "bg-[#D8103F] text-white shadow-sm"
                    : "bg-brand-secondary text-brand-highlight hover:bg-slate-100"
                }`}
              >
                {mode === "everyone" ? "Everyone" : mode === "followers" ? "Followers Only" : "No One"}
              </button>
            ))}
          </div>
        </div>

        {/* Blocked words */}
        <div className="mt-5 border-t border-brand-divider pt-5">
          <label className="mb-2 block text-[12px] font-semibold text-brand-highlight">
            Blocked Words
          </label>
          <p className="mb-3 text-[11px] text-brand-text/60">
            Comments containing these words will be automatically hidden.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBlockedWord(); } }}
              placeholder="Add a word..."
              className="h-9 flex-1 rounded-lg border border-brand-divider bg-brand-secondary px-3 text-[12px] text-slate-800 outline-none focus:border-[#D8103F]/30 focus:bg-brand-card focus:ring-2 focus:ring-[#D8103F]/10"
            />
            <button
              type="button"
              onClick={addBlockedWord}
              disabled={!newWord.trim()}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-brand-highlight hover:bg-slate-200 disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {blockedWords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {blockedWords.map((word) => (
                <span
                  key={word}
                  className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-brand-highlight"
                >
                  {word}
                  <button type="button" onClick={() => removeBlockedWord(word)} className="text-brand-text/60 hover:text-brand-highlight">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Content Permissions */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-2 text-[14px] font-bold text-brand-text">Content Permissions</h2>
        <div className="divide-y divide-slate-100">
          <SettingsRow
            label="Allow Remix / Duet"
            description="Let others create remixes or duets with your Postgram reels"
          >
            <Toggle enabled={allowRemix} onChange={setAllowRemix} />
          </SettingsRow>
          <SettingsRow
            label="Allow Downloads"
            description="Let viewers download your Postgram reels"
          >
            <Toggle enabled={allowDownload} onChange={setAllowDownload} />
          </SettingsRow>
          <SettingsRow
            label="Content Warning (18+)"
            description="Mark your channel as containing mature content"
          >
            <Toggle enabled={contentWarning} onChange={setContentWarning} />
          </SettingsRow>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        <AnimatePresence>
          {saved ? (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600"
            >
              <Check className="h-3.5 w-3.5" />
              Saved
            </motion.span>
          ) : null}
        </AnimatePresence>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="rounded-xl bg-[#D8103F] px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-[#b80d35] disabled:opacity-50"
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
