"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { useMyChannels, useUpdateChannel } from "@/hooks/useChannels";
import { useCheckHandle, useChangeHandle } from "@/hooks/useChannelSettings";
import api from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

const CATEGORIES = [
  "Technology", "Education", "Comedy", "Gaming", "Music", "Lifestyle",
  "Sports", "News", "Travel", "Food", "Fashion", "Fitness",
  "Science", "Art", "Entertainment", "Business", "Health", "Other",
];

const LANGUAGES = [
  "English", "Hindi", "Spanish", "French", "German", "Portuguese",
  "Japanese", "Korean", "Chinese", "Arabic", "Russian", "Dutch",
  "Italian", "Turkish", "Indonesian", "Thai", "Vietnamese", "Other",
];

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
      <h2 className="mb-5 text-[14px] font-bold text-brand-text">{title}</h2>
      {children}
    </div>
  );
}

export function GeneralTab() {
  const { data: channels, refetch: refetchChannels } = useMyChannels();
  const channel = channels?.[0];
  const updateMutation = useUpdateChannel();
  const checkHandle = useCheckHandle();
  const changeHandle = useChangeHandle();
  const ensurePublisher = useMutation({
    mutationFn: async () => {
      await api.post("/v1/onboarding/ensure-publisher");
      const { data } = await refetchChannels();
      return data?.[0] ?? null;
    },
  });

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("English");
  const [location, setLocation] = useState("");
  const [saved, setSaved] = useState(false);

  // Handle change modal
  const [handleModalOpen, setHandleModalOpen] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [handleConfirmed, setHandleConfirmed] = useState(false);

  useEffect(() => {
    if (channel) {
      setName(channel.name || "");
      setCategory(channel.category || "");
    }
  }, [channel]);

  const handleSave = useCallback(async () => {
    if (!channel) return;
    await updateMutation.mutateAsync({
      id: channel.id,
      name,
      description: channel.description || "",
      category,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [channel, name, category, updateMutation]);

  const [handleReason, setHandleReason] = useState<string | null>(null);

  const handleCheckAvailability = useCallback(async () => {
    if (!newHandle || newHandle.length < 3) return;
    const result = await checkHandle.mutateAsync(newHandle);
    setHandleAvailable(result.available);
    setHandleReason(result.reason ?? null);
  }, [newHandle, checkHandle]);

  const handleConfirmChange = useCallback(async () => {
    if (!handleAvailable || !handleConfirmed) return;
    await changeHandle.mutateAsync(newHandle);
    setHandleModalOpen(false);
    setNewHandle("");
    setHandleAvailable(null);
    setHandleConfirmed(false);
  }, [handleAvailable, handleConfirmed, newHandle, changeHandle]);

  if (!channel) {
    return (
      <div className="space-y-6">
        <SettingsCard title="Channel Setup">
          <div className="flex flex-col items-center py-8 text-center">
            <p className="text-[13px] text-brand-highlight">You don&apos;t have a channel yet. Create one to manage your PostTube settings.</p>
            <button
              type="button"
              onClick={() => ensurePublisher.mutate()}
              disabled={ensurePublisher.isPending}
              className="mt-4 rounded-xl bg-brand-text px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-text disabled:opacity-50 transition-colors"
            >
              {ensurePublisher.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Channel"
              )}
            </button>
            {ensurePublisher.isError && (
              <p className="mt-3 text-[12px] text-rose-500">
                Failed to create channel. Please try again.
              </p>
            )}
          </div>
        </SettingsCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Channel Name + Handle */}
      <SettingsCard title="Channel Identity">
        <div className="space-y-5">
          {/* Channel Name */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
              Channel Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none transition-all focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
              placeholder="My Awesome Channel"
            />
            <p className="mt-1 text-[11px] text-brand-text/60">{name.length}/50 characters</p>
          </div>

          {/* Handle */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
              Handle
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-10 flex-1 items-center rounded-xl border border-brand-divider bg-brand-secondary px-3">
                <span className="text-[13px] text-brand-text/60">@</span>
                <span className="ml-0.5 text-[13px] font-medium text-brand-text">
                  {channel?.handle || "—"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHandleModalOpen(true)}
                className="shrink-0 rounded-xl bg-brand-secondary px-4 py-2.5 text-[12px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>


      {/* Category + Language + Location */}
      <SettingsCard title="Details">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
              Category / Topic
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none transition-all focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
            >
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none transition-all focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
              Location (optional)
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none transition-all focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
              placeholder="e.g. Mumbai, India"
            />
          </div>
        </div>
      </SettingsCard>

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
          className="rounded-xl bg-brand-text px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-text disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save Changes"
          )}
        </button>
      </div>

      {/* Handle Change Modal */}
      <AnimatePresence>
        {handleModalOpen ? (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-[440px] rounded-2xl bg-brand-card shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-brand-divider px-6 py-4">
                <h3 className="text-[15px] font-bold text-brand-text">Change Handle</h3>
                <button
                  type="button"
                  onClick={() => { setHandleModalOpen(false); setNewHandle(""); setHandleAvailable(null); setHandleConfirmed(false); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 hover:bg-brand-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Warning */}
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="text-[12px] leading-relaxed text-amber-800">
                    <p className="font-bold">This affects all platforms</p>
                    <p className="mt-0.5">
                      Changing your handle updates all links and @mentions across
                      Postbook, Postgram, and Posttube. Old links will redirect for 30 days.
                    </p>
                    <p className="mt-1.5 font-medium">
                      You can change your handle once every 30 days.
                    </p>
                  </div>
                </div>

                {/* Handle rules */}
                <div className="rounded-xl bg-brand-secondary p-3">
                  <p className="text-[11px] font-semibold text-brand-highlight mb-1">Handle rules:</p>
                  <ul className="space-y-0.5 text-[11px] text-brand-text/60">
                    <li>3-24 characters, lowercase a-z, 0-9, underscore</li>
                    <li>Cannot start or end with underscore</li>
                    <li>No consecutive underscores</li>
                    <li>Cannot contain reserved words</li>
                  </ul>
                </div>

                {/* New handle input */}
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    New Handle
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-brand-text/60">
                        @
                      </span>
                      <input
                        value={newHandle}
                        onChange={(e) => {
                          setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                          setHandleAvailable(null);
                        }}
                        maxLength={24}
                        className="h-10 w-full rounded-xl border border-brand-divider bg-brand-card pl-7 pr-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:ring-2 focus:ring-brand-text/10"
                        placeholder="new_handle"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCheckAvailability}
                      disabled={newHandle.length < 3 || checkHandle.isPending}
                      className="shrink-0 rounded-xl bg-brand-secondary px-4 py-2 text-[12px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary disabled:opacity-40"
                    >
                      {checkHandle.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Check"
                      )}
                    </button>
                  </div>

                  {handleAvailable !== null ? (
                    <p className={`mt-1.5 text-[12px] font-medium ${handleAvailable ? "text-emerald-600" : "text-rose-500"}`}>
                      {handleAvailable
                        ? `@${newHandle} is available`
                        : handleReason || `@${newHandle} is taken`}
                    </p>
                  ) : null}
                </div>

                {/* Confirmation checkbox */}
                {handleAvailable ? (
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handleConfirmed}
                      onChange={(e) => setHandleConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-brand-text/30 text-brand-text focus:ring-brand-text/50"
                    />
                    <span className="text-[12px] leading-relaxed text-brand-highlight">
                      I understand this change syncs across all platforms and I won&apos;t be able
                      to change it again for 30 days.
                    </span>
                  </label>
                ) : null}
              </div>

              <div className="border-t border-brand-divider px-6 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setHandleModalOpen(false); setNewHandle(""); setHandleAvailable(null); setHandleConfirmed(false); }}
                  className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-brand-highlight hover:bg-brand-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmChange}
                  disabled={!handleAvailable || !handleConfirmed || changeHandle.isPending}
                  className="rounded-xl bg-brand-text px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-text disabled:opacity-40"
                >
                  {changeHandle.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirm Change"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
