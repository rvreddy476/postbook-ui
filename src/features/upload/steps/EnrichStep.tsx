"use client";

import { Captions, FileText, Languages, ListOrdered } from "lucide-react";

import { PUBLISH_LANGUAGES } from "@/features/posttube/hub";
import { validateChapterRows } from "@/features/posttube/hub/chaptersModel";
import { ChaptersEditor } from "@/features/posttube/hub/components/ChaptersEditor";
import { Section, StudioSelect } from "../primitives";
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

/*
  Extras (long video and podcasts): language, a subtitle file and
  chapters. License, embedding and the recording date and place are not
  asked at upload any more (2026-10-21); the Creator Hub edits them.
*/
export function EnrichStep({ form, patch, showErrors }: EnrichStepProps) {
  const durationMs = form.videoDurationSec ? form.videoDurationSec * 1000 : null;
  const chapterIssues = validateChapterRows(form.chapterRows, durationMs);
  const invalidKeys = new Set(chapterIssues.map((i) => i.key).filter((k): k is number => k !== null));
  return (
    <div className="upload-stack">
      <Section title="Language" subtitle="The main language spoken in the video" icon={Languages}>
        <StudioSelect id="upload-language" label="Language" value={form.language} onChange={(v) => patch({ language: v })} options={LANGUAGES} />
      </Section>

      <Section title="Subtitles" subtitle="Optional. An SRT or VTT file in the language above" icon={Captions}>
        <label className="upload-dropzone" data-compact>
          <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="mt-2 text-[13px] font-semibold text-brand-text">{form.subtitlesFile ? form.subtitlesFile.name : "Choose a subtitle file"}</span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">.srt or .vtt · you can add more later in Creator Hub</span>
          <input
            type="file"
            accept=".srt,.vtt"
            onChange={(e) => patch({
              subtitlesFile: e.target.files?.[0] ?? null,
              subtitleUploadState: "idle",
              subtitleUploadError: null,
            })}
            className="upload-sr-only"
          />
        </label>
        {form.subtitleUploadState === "uploading" && (
          <p className="upload-input-hint" role="status">Uploading the subtitle track…</p>
        )}
        {form.subtitleUploadState === "done" && form.subtitleTracks.length > 0 && (
          <div className="upload-banner" role="status">
            <div>
              <p className="text-[12px] font-semibold text-success">Subtitle tracks saved</p>
              {form.subtitleTracks.map((track) => (
                <p key={track.id} className="text-[11px] text-muted-foreground">
                  {track.language.toUpperCase()} · {track.format.toUpperCase()} · {track.source.replace(/_/g, " ")}
                </p>
              ))}
            </div>
          </div>
        )}
        {form.subtitleUploadState === "error" && form.subtitleUploadError && (
          <p className="upload-field-error" role="alert">{form.subtitleUploadError}</p>
        )}
      </Section>

      {/* Chapters: saved right after publish; the Creator Hub edits them later. */}
      <Section title="Chapters" subtitle="Start times and titles viewers can jump to. The first starts at 0:00." icon={ListOrdered}>
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
      </Section>
    </div>
  );
}
