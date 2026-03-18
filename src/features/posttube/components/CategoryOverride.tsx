"use client";

import { useState, useCallback } from "react";
import { Tag } from "lucide-react";
import { overrideVideoCategory } from "../data/posttubeApi";

interface CategoryOverrideProps {
  videoId: string;
  computedCategory: "flick" | "long_video";
  currentCategory: "flick" | "long_video";
  durationSeconds: number;
  orientation: string;
  onCategoryChange?: (category: "flick" | "long_video") => void;
}

export function CategoryOverride({
  videoId,
  computedCategory,
  currentCategory,
  durationSeconds,
  orientation,
  onCategoryChange,
}: CategoryOverrideProps) {
  const [selected, setSelected] = useState(currentCategory);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flick is only valid if <=180s AND not landscape
  const canBeFlick = durationSeconds <= 180 && orientation !== "landscape";

  const handleChange = useCallback(
    async (value: "flick" | "long_video") => {
      if (value === selected) return;
      setError(null);
      setSaving(true);
      try {
        await overrideVideoCategory(videoId, value);
        setSelected(value);
        onCategoryChange?.(value);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to update category";
        setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [videoId, selected, onCategoryChange],
  );

  return (
    <div className="rounded-xl border border-brand-divider bg-brand-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="h-4 w-4 text-brand-highlight" />
        <h3 className="text-[14px] font-semibold text-brand-text">Category</h3>
        <span className="text-[11px] text-brand-text/60 ml-auto">
          Auto: {computedCategory === "flick" ? "Flick" : "Video"}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleChange("flick")}
          disabled={!canBeFlick || saving}
          className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
            selected === "flick"
              ? "bg-amber-500 text-white"
              : canBeFlick
                ? "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary"
                : "bg-brand-secondary text-brand-text/30 cursor-not-allowed"
          }`}
        >
          Flick
        </button>
        <button
          type="button"
          onClick={() => handleChange("long_video")}
          disabled={saving}
          className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
            selected === "long_video"
              ? "bg-blue-600 text-white"
              : "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary"
          }`}
        >
          Video
        </button>
      </div>

      {!canBeFlick && (
        <p className="mt-2 text-[11px] text-brand-text/60">
          Flick requires ≤180s duration and portrait/square orientation.
        </p>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-red-500">{error}</p>
      )}

      {saving && (
        <p className="mt-2 text-[11px] text-blue-500">Updating...</p>
      )}
    </div>
  );
}
