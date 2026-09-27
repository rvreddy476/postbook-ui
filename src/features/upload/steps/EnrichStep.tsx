"use client";

import { PUBLISH_LANGUAGES } from "@/features/posttube/hub";
import { validateChapterRows } from "@/features/posttube/hub/chaptersModel";
import { ChaptersEditor } from "@/features/posttube/hub/components/ChaptersEditor";
import { SectionHeader, ToggleRow, RadioOption, StudioInput, StudioSelect } from "../primitives";
import type { StudioFormState } from "../types";

interface EnrichStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
}

const BASE_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "ru", label: "Russian" },
  { value: "id", label: "Indonesian" },
  { value: "tr", label: "Turkish" },
  { value: "th", label: "Thai" },
  { value: "vi", label: "Vietnamese" },
];

/** The studio's list plus every language Creator Hub → Preferences can store, so a default always shows. */
const LANGUAGES = [
  ...BASE_LANGUAGES,
  ...PUBLISH_LANGUAGES.filter((l) => l.code && !BASE_LANGUAGES.some((b) => b.value === l.code)).map((l) => ({ value: l.code, label: l.label })),
];

export function EnrichStep({ form, patch, showErrors }: EnrichStepProps) {
  const durationMs = form.videoDurationSec ? form.videoDurationSec * 1000 : null;
  const chapterIssues = validateChapterRows(form.chapterRows, durationMs);
  const invalidKeys = new Set(chapterIssues.map((i) => i.key).filter((k): k is number => k !== null));
  return (
    <div className="space-y-6">
      {/* ── Language ── */}
      <div>
        <SectionHeader title="Language" subtitle="Set the primary language of your content" />
        <StudioSelect
          value={form.language}
          onChange={(v) => patch({ language: v })}
          options={LANGUAGES}
        />
      </div>

      {/* ── Subtitles ── */}
      <div>
        <SectionHeader title="Subtitles" subtitle="Upload a subtitle file for accessibility" />
        <div className="rounded-xl border border-brand-text/10 p-4">
          <p className="text-[12px] text-brand-text/50 mb-3">
            Upload an SRT or VTT file to add subtitles. Auto-generated subtitles will be created if no file is provided.
          </p>
          <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-brand-text/10 bg-brand-secondary py-6 text-[12px] text-brand-text/50 hover:border-brand-text/40 hover:bg-brand-secondary/20 transition-colors">
            {form.subtitlesFile ? form.subtitlesFile.name : "Click to upload .srt or .vtt file"}
            <input
              type="file"
              accept=".srt,.vtt"
              onChange={(e) => patch({
                subtitlesFile: e.target.files?.[0] ?? null,
                subtitleUploadState: "idle",
                subtitleUploadError: null,
              })}
              className="hidden"
            />
          </label>
          {form.subtitleUploadState === "uploading" && (
            <p className="mt-3 text-[12px] text-brand-text">Uploading subtitle track...</p>
          )}
          {form.subtitleUploadState === "done" && form.subtitleTracks.length > 0 && (
            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[12px] font-semibold text-emerald-500 dark:text-emerald-400">Subtitle tracks saved</p>
              <div className="mt-2 space-y-1">
                {form.subtitleTracks.map((track) => (
                  <p key={track.id} className="text-[11px] text-brand-text/60">
                    {track.language.toUpperCase()} • {track.format.toUpperCase()} • {track.source.replace(/_/g, " ")}
                  </p>
                ))}
              </div>
            </div>
          )}
          {form.subtitleUploadState === "error" && form.subtitleUploadError && (
            <p className="mt-3 text-[12px] text-rose-500">{form.subtitleUploadError}</p>
          )}
        </div>
      </div>

      {/* ── Chapters (saved right after publish; the Creator Hub edits them later) ── */}
      <div>
        <SectionHeader title="Chapters" subtitle="Start times and titles viewers can jump to. The first starts at 0:00." />
        <ChaptersEditor
          rows={form.chapterRows}
          onChange={(rows) => patch({ chapterRows: rows })}
          emptyHint="Optional. Without them, timestamps in the description (00:00 Intro) become chapters."
          invalidKeys={showErrors ? invalidKeys : undefined}
          footer={
            chapterIssues.length > 0 && (showErrors || form.chapterRows.length > 1) ? (
              <ul className="space-y-0.5" data-issues="chapters">
                {chapterIssues.map((issue, i) => (
                  <li key={i} className="hub-hint is-error">
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
      </div>

      {/* ── Recording Details ── */}
      <div>
        <SectionHeader title="Recording Details" subtitle="Optional metadata about when and where this was recorded" />
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-brand-text/60">Recording Date</p>
            <input
              type="date"
              value={form.recordingDate}
              onChange={(e) => patch({ recordingDate: e.target.value })}
              className="h-11 w-full rounded-xl border border-brand-text/10 bg-brand-secondary px-4 text-[13px] text-brand-text outline-hidden focus:border-brand-text focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10 transition-all"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-brand-text/60">Recording Location</p>
            <StudioInput
              value={form.recordingLocation}
              onChange={(v) => patch({ recordingLocation: v })}
              placeholder="e.g., Mumbai, India"
            />
          </div>
        </div>
      </div>

      {/* ── License ── */}
      <div>
        <SectionHeader title="License" subtitle="Choose a license for your content" />
        <div className="space-y-1 rounded-xl border border-brand-text/10 p-2">
          <RadioOption
            name="license"
            label="Standard VChat License"
            description="Default license — you retain rights, VChat can distribute"
            checked={form.license === "standard"}
            onChange={() => patch({ license: "standard" })}
          />
          <RadioOption
            name="license"
            label="Creative Commons — Attribution"
            description="Others can share, remix, and build upon your work with credit"
            checked={form.license === "creative_commons"}
            onChange={() => patch({ license: "creative_commons" })}
          />
        </div>
      </div>

      {/* ── Embedding ── */}
      <div className="rounded-xl border border-brand-text/10 p-4">
        <ToggleRow
          label="Allow Embedding"
          description="Let others embed this content on external websites"
          checked={form.allowEmbedding}
          onChange={(v) => patch({ allowEmbedding: v })}
        />
      </div>
    </div>
  );
}
