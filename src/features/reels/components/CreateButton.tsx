"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Plus, Film, Clapperboard, Radio, Mic, PenSquare } from "lucide-react";

const CREATE_OPTIONS = [
  {
    label: "Video",
    description: "Upload a full-length video to Posttube",
    href: "/posttube/upload?type=long",
    icon: Film,
    color: "from-violet-500 to-indigo-500",
    hoverBg: "hover:bg-violet-50",
  },
  {
    label: "Flick / Clip",
    description: "Short vertical video with music & effects",
    href: "/posttube/upload?type=short",
    icon: Clapperboard,
    color: "from-fuchsia-500 to-pink-500",
    hoverBg: "hover:bg-fuchsia-50",
  },
  {
    label: "Live",
    description: "Go live and interact with your audience",
    href: "/live/start",
    icon: Radio,
    color: "from-rose-500 to-red-500",
    hoverBg: "hover:bg-rose-50",
  },
  {
    label: "Podcast",
    description: "Record or upload a podcast episode",
    href: "/posttube/upload?type=podcast",
    icon: Mic,
    color: "from-amber-500 to-orange-500",
    hoverBg: "hover:bg-amber-50",
  },
  {
    label: "Create Post",
    description: "Share text, photos, or a quick update",
    href: "/create/post",
    icon: PenSquare,
    color: "from-blue-500 to-cyan-500",
    hoverBg: "hover:bg-blue-50",
  },
] as const;

export function CreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md transition-shadow hover:shadow-lg"
        aria-label="Create"
      >
        <Sparkles className="h-[17px] w-[17px]" />
        <Plus className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-white text-violet-600 shadow-sm" strokeWidth={3} />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "circOut" }}
            className="absolute right-0 mt-3 w-[280px] rounded-2xl border border-slate-200/60 bg-white/95 p-1.5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl z-[100]"
          >
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Create New
              </p>
            </div>

            {CREATE_OPTIONS.map((option) => (
              <button
                key={option.href}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(option.href);
                }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${option.hoverBg}`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${option.color} text-white shadow-sm`}>
                  <option.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[13px] font-semibold text-slate-900">{option.label}</p>
                  <p className="text-[11px] text-slate-400">{option.description}</p>
                </div>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
