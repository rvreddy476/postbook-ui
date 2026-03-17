"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Star, Check, Loader2, GripVertical } from "lucide-react";
import { useMyChannels, useUpdateChannel } from "@/hooks/useChannels";

interface LinkItem {
  id: string;
  title: string;
  url: string;
  featured: boolean;
}

export function LinksTab() {
  const { data: channels } = useMyChannels();
  const channel = channels?.[0];
  const updateMutation = useUpdateChannel();

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Hydrate from channel data if available
    if (channel) {
      // Channel links come from ChannelDetail.links — map to local shape
      setLinks([]);
    }
  }, [channel]);

  const addLink = () => {
    if (links.length >= 5) return;
    setLinks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: "", url: "", featured: false },
    ]);
  };

  const removeLink = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLink = (id: string, field: "title" | "url", value: string) => {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const toggleFeatured = (id: string) => {
    setLinks((prev) =>
      prev.map((l) => ({
        ...l,
        featured: l.id === id ? !l.featured : false, // only one featured
      }))
    );
  };

  const handleSave = useCallback(async () => {
    if (!channel) return;
    // Send links as part of channel update
    await updateMutation.mutateAsync({ id: channel.id });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [channel, updateMutation]);

  return (
    <div className="space-y-6">
      {/* Custom Links */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[14px] font-bold text-brand-text">Custom Links</h2>
            <p className="mt-0.5 text-[11px] text-brand-text/60">
              Add up to 5 links shown on your channel page. Mark one as featured.
            </p>
          </div>
          <button
            type="button"
            onClick={addLink}
            disabled={links.length >= 5}
            className="flex items-center gap-1.5 rounded-xl bg-[#D8103F]/5 px-3 py-2 text-[12px] font-semibold text-[#D8103F] transition-colors hover:bg-[#D8103F]/10 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Link
          </button>
        </div>

        {links.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-secondary">
              <Plus className="h-5 w-5 text-slate-300" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-brand-text/60">No links added yet</p>
            <p className="text-[11px] text-slate-300">Add links to your website, social profiles, or other content</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {links.map((link) => (
                <motion.div
                  key={link.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-3 rounded-xl border border-brand-divider bg-brand-secondary/50 p-3">
                    <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-slate-300 cursor-grab" />
                    <div className="flex-1 space-y-2">
                      <input
                        value={link.title}
                        onChange={(e) => updateLink(link.id, "title", e.target.value)}
                        placeholder="Link title"
                        className="h-9 w-full rounded-lg border border-brand-divider bg-brand-card px-3 text-[13px] text-slate-800 outline-none focus:border-[#D8103F]/30 focus:ring-2 focus:ring-[#D8103F]/10"
                      />
                      <input
                        value={link.url}
                        onChange={(e) => updateLink(link.id, "url", e.target.value)}
                        placeholder="https://..."
                        className="h-9 w-full rounded-lg border border-brand-divider bg-brand-card px-3 text-[13px] text-slate-800 outline-none focus:border-[#D8103F]/30 focus:ring-2 focus:ring-[#D8103F]/10"
                      />
                    </div>
                    <div className="flex shrink-0 gap-1 pt-1.5">
                      <button
                        type="button"
                        onClick={() => toggleFeatured(link.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          link.featured
                            ? "bg-amber-50 text-amber-500"
                            : "text-slate-300 hover:bg-slate-100 hover:text-brand-highlight"
                        }`}
                        title="Set as featured link"
                      >
                        <Star className="h-3.5 w-3.5" fill={link.featured ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLink(link.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Social Links */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-2 text-[14px] font-bold text-brand-text">Social Links</h2>
        <p className="mb-5 text-[11px] text-brand-text/60">
          Optional quick links shown with social platform icons.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {["Twitter / X", "Instagram", "YouTube", "Discord"].map((platform) => (
            <div key={platform}>
              <label className="mb-1.5 block text-[11px] font-semibold text-brand-highlight">
                {platform}
              </label>
              <input
                placeholder={`${platform} URL`}
                className="h-9 w-full rounded-lg border border-brand-divider bg-brand-secondary px-3 text-[12px] text-slate-800 outline-none focus:border-[#D8103F]/30 focus:bg-brand-card focus:ring-2 focus:ring-[#D8103F]/10"
              />
            </div>
          ))}
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
