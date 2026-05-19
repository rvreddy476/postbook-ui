"use client";

import { SectionHeader, ToggleRow, RadioOption, StudioInput, StudioSelect } from "../primitives";
import type { StudioFormState } from "../types";

interface EnrichStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
}

const LANGUAGES = [
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

export function EnrichStep({ form, patch }: EnrichStepProps) {
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
        <div className="rounded-xl border border-[#E8E6E1] p-4">
          <p className="text-[12px] text-[#9E9E9E] mb-3">
            Upload an SRT or VTT file to add subtitles. Auto-generated subtitles will be created if no file is provided.
          </p>
          <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#E8E6E1] bg-[#FAFAF8] py-6 text-[12px] text-[#9E9E9E] hover:border-[#7C5CFC]/40 hover:bg-[#EDE9FE]/20 transition-colors">
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
            <p className="mt-3 text-[12px] text-[#7C5CFC]">Uploading subtitle track...</p>
          )}
          {form.subtitleUploadState === "done" && form.subtitleTracks.length > 0 && (
            <div className="mt-3 rounded-xl border border-[#2BB5A0]/20 bg-[#2BB5A0]/5 p-3">
              <p className="text-[12px] font-semibold text-[#2BB5A0]">Subtitle tracks saved</p>
              <div className="mt-2 space-y-1">
                {form.subtitleTracks.map((track) => (
                  <p key={track.id} className="text-[11px] text-[#6B6B6B]">
                    {track.language.toUpperCase()} • {track.format.toUpperCase()} • {track.source.replace(/_/g, " ")}
                  </p>
                ))}
              </div>
            </div>
          )}
          {form.subtitleUploadState === "error" && form.subtitleUploadError && (
            <p className="mt-3 text-[12px] text-[#E8527A]">{form.subtitleUploadError}</p>
          )}
        </div>
      </div>

      {/* ── Recording Details ── */}
      <div>
        <SectionHeader title="Recording Details" subtitle="Optional metadata about when and where this was recorded" />
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-[#6B6B6B]">Recording Date</p>
            <input
              type="date"
              value={form.recordingDate}
              onChange={(e) => patch({ recordingDate: e.target.value })}
              className="h-11 w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-4 text-[13px] text-[#1A1A1A] outline-none focus:border-[#7C5CFC] focus:bg-brand-card focus:ring-2 focus:ring-[#7C5CFC]/10 transition-all"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-[#6B6B6B]">Recording Location</p>
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
        <div className="space-y-1 rounded-xl border border-[#E8E6E1] p-2">
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
      <div className="rounded-xl border border-[#E8E6E1] p-4">
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
