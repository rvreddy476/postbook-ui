"use client";

import { useState } from "react";
import {
  Radio,
  Video,
  MonitorPlay,
  MessageSquare,
  Users,
  ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { AppShell } from "@/features/reels/components/AppShell";

const CATEGORIES = [
  "Just Chatting", "Gaming", "Music", "Q&A", "Tutorial",
  "Cooking", "Fitness", "Technology", "Art", "Other",
];

export default function LiveStartPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);

  return (
    <AppShell sectionLabel="Live">
      <div className="mx-auto max-w-[860px] px-6 py-8">
        {/* Page title */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
            <Radio className="h-5 w-5 text-rose-500" />
          </div>
          <h1 className="text-[18px] font-bold text-brand-text">Go Live</h1>
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-8">
          {/* Left: Camera preview */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-brand-divider bg-black" style={{ aspectRatio: "16/9" }}>
              <div className="flex h-full items-center justify-center">
                {cameraOn ? (
                  <div className="flex flex-col items-center gap-3">
                    <Video className="h-8 w-8 text-white/40" />
                    <p className="text-[13px] text-white/50">Camera preview will appear here</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <MonitorPlay className="h-8 w-8 text-white/40" />
                    <p className="text-[13px] text-white/50">Screen share mode</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCameraOn(!cameraOn)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all ${
                  cameraOn ? "bg-slate-900 text-white" : "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary"
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                Camera {cameraOn ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() => setChatEnabled(!chatEnabled)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all ${
                  chatEnabled ? "bg-slate-900 text-white" : "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat {chatEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Right: Settings */}
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm"
            >
              <h2 className="mb-4 text-[14px] font-bold text-brand-text">Stream Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">Title <span className="text-rose-400">*</span></label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10" placeholder="What are you streaming?" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">Category</label>
                  <div className="relative">
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full appearance-none rounded-xl border border-brand-divider bg-brand-secondary px-3 pr-8 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10">
                      <option value="">Select category</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-text/60" />
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="flex items-center gap-3 rounded-xl bg-brand-secondary px-4 py-3">
              <Users className="h-4 w-4 text-brand-text/60" />
              <span className="text-[12px] text-brand-highlight">Your stream will be visible to all followers</span>
            </div>

            <button
              type="button"
              disabled={!title.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 py-3 text-[14px] font-bold text-white shadow-lg shadow-rose-200 transition-all hover:shadow-xl hover:shadow-rose-300 disabled:opacity-40 disabled:shadow-none"
            >
              <Radio className="h-4 w-4" />
              Go Live
            </button>

            <p className="text-center text-[11px] text-brand-text/60">
              By going live you agree to the community guidelines.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
