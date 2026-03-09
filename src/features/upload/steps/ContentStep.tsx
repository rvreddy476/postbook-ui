"use client";

import { useCallback, useRef } from "react";
import { Upload, FileVideo, X, Image as ImageIcon, Loader2, Music, Volume2 } from "lucide-react";
import { SectionHeader, FieldLabel, TagChip, StudioInput, StudioTextarea, Collapsible } from "../primitives";
import type { StudioFormState } from "../types";
import { CONTENT_TYPE_META, type ContentType } from "../tokens";

interface ContentStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  selectFile: (f: File) => void;
  clearFile: () => void;
  uploadMutation: { mutate: () => void; isPending: boolean };
  extractCoverMutation: { mutate: (ts: number) => void; isPending: boolean };
  contentType: ContentType;
}

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function fmtMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

export function ContentStep({
  form,
  patch,
  selectFile,
  clearFile,
  uploadMutation,
  extractCoverMutation,
  contentType,
}: ContentStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const config = CONTENT_TYPE_META[contentType];

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) selectFile(f);
    },
    [selectFile],
  );

  const addHashtag = useCallback(() => {
    const raw = form.hashtagInput.trim().replace(/^#/, "").toLowerCase();
    if (!raw || form.hashtags.includes(`#${raw}`)) return;
    if (form.hashtags.length >= 30) return;
    patch({ hashtags: [...form.hashtags, `#${raw}`], hashtagInput: "" });
  }, [form.hashtagInput, form.hashtags, patch]);

  const removeHashtag = useCallback(
    (tag: string) => patch({ hashtags: form.hashtags.filter((t) => t !== tag) }),
    [form.hashtags, patch],
  );

  return (
    <div className="space-y-6">
      {/* ── File Upload Zone ── */}
      {!form.videoFile ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E8E6E1] bg-[#FAFAF8] py-16 transition-colors hover:border-[#7C5CFC]/40 hover:bg-[#EDE9FE]/20"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F4F1] group-hover:bg-[#EDE9FE] transition-colors">
            <Upload className="h-6 w-6 text-[#9E9E9E] group-hover:text-[#7C5CFC]" />
          </div>
          <p className="mt-4 text-[14px] font-semibold text-[#1A1A1A]">Drag & drop your file here</p>
          <p className="mt-1 text-[12px] text-[#9E9E9E]">or click to browse</p>
          <p className="mt-3 text-[11px] text-[#BFBFBF]">{config.label} — max {config.maxSize / (1024 * 1024)} MB</p>
          <input ref={fileRef} type="file" accept="video/*,audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); }} className="hidden" />
        </div>
      ) : (
        <>
          {/* ── File info bar ── */}
          <div className="flex items-center gap-3 rounded-xl bg-[#FAFAF8] border border-[#E8E6E1] px-4 py-3">
            <FileVideo className="h-4 w-4 shrink-0 text-[#7C5CFC]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[#1A1A1A]">{form.videoFile.name}</p>
              <p className="text-[11px] text-[#9E9E9E]">
                {(form.videoFile.size / (1024 * 1024)).toFixed(1)} MB
                {form.videoDurationSec != null && ` · ${fmtDuration(form.videoDurationSec)}`}
              </p>
            </div>

            {/* Upload progress / status */}
            {form.uploadPhase === "idle" && (
              <button type="button" onClick={() => uploadMutation.mutate()} className="rounded-lg bg-[#7C5CFC] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#6A4AE8] transition-colors">
                Upload
              </button>
            )}
            {form.uploadPhase === "uploading" && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-[#E8E6E1] overflow-hidden">
                  <div className="h-full rounded-full bg-[#7C5CFC] transition-all" style={{ width: `${form.uploadProgress}%` }} />
                </div>
                <span className="text-[11px] font-medium text-[#7C5CFC]">{form.uploadProgress}%</span>
              </div>
            )}
            {(form.uploadPhase === "confirming" || form.uploadPhase === "creating_draft") && (
              <span className="flex items-center gap-1.5 text-[11px] text-[#9E9E9E]">
                <Loader2 className="h-3 w-3 animate-spin" /> Processing...
              </span>
            )}
            {form.uploadPhase === "done" && (
              <span className="text-[11px] font-semibold text-[#2BB5A0]">Uploaded</span>
            )}

            <button type="button" onClick={() => { fileRef.current?.click(); }} className="text-[11px] font-semibold text-[#7C5CFC] hover:text-[#6A4AE8]">Change</button>
            <button type="button" onClick={clearFile} className="flex h-6 w-6 items-center justify-center rounded-full text-[#9E9E9E] hover:bg-[#F5F4F1] hover:text-[#1A1A1A]">
              <X className="h-3.5 w-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="video/*,audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); }} className="hidden" />
          </div>

          {form.uploadError && (
            <p className="text-[12px] text-[#E8527A]">{form.uploadError}</p>
          )}
        </>
      )}

      {/* ── Title & Caption ── */}
      <div>
        <SectionHeader title="Details" subtitle="Add a title and description for your content" />
        <div className="space-y-4">
          <div>
            <FieldLabel label="Title" required counter={`${form.title.length}/100`} />
            <StudioInput
              value={form.title}
              onChange={(v) => patch({ title: v })}
              placeholder="Add a title that describes your content"
              maxLength={100}
              autoFocus={!!form.videoFile}
            />
          </div>
          <div>
            <FieldLabel label="Caption / Description" counter={`${form.caption.length}/2200`} />
            <StudioTextarea
              value={form.caption}
              onChange={(v) => patch({ caption: v })}
              placeholder="Tell viewers about your content. Use #hashtags and @mentions."
              maxLength={2200}
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* ── Hashtags ── */}
      <div>
        <FieldLabel label="Hashtags" hint={`${form.hashtags.length}/30`} />
        <div className="flex gap-2">
          <StudioInput
            value={form.hashtagInput}
            onChange={(v) => patch({ hashtagInput: v })}
            placeholder="Type a hashtag and press Enter"
          />
          <button
            type="button"
            onClick={addHashtag}
            className="shrink-0 rounded-xl bg-[#F5F4F1] px-4 text-[12px] font-semibold text-[#6B6B6B] hover:bg-[#E8E6E1] transition-colors"
          >
            Add
          </button>
        </div>
        {form.hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.hashtags.map((tag) => (
              <TagChip key={tag} label={tag} onRemove={() => removeHashtag(tag)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Cover Picker ── */}
      {form.videoPreviewUrl && contentType !== "podcast" && (
        <Collapsible title="Cover Image" defaultOpen={false}>
          <div className="space-y-3">
            <p className="text-[12px] text-[#9E9E9E]">Choose a frame from your video as the cover image</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={(form.videoDurationSec ?? 30) * 1000}
                step={100}
                value={form.coverTimestampMs ?? 0}
                onChange={(e) => patch({ coverTimestampMs: Number(e.target.value) })}
                className="flex-1 accent-[#7C5CFC]"
              />
              <span className="text-[11px] font-mono text-[#6B6B6B] w-10 text-right">{fmtMs(form.coverTimestampMs ?? 0)}</span>
            </div>
            <button
              type="button"
              onClick={() => extractCoverMutation.mutate(form.coverTimestampMs ?? 0)}
              disabled={extractCoverMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-[#7C5CFC] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#6A4AE8] disabled:opacity-40 transition-colors"
            >
              {extractCoverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              Extract Cover
            </button>
            {form.coverResult && (
              <div className="mt-2 overflow-hidden rounded-xl border border-[#E8E6E1]" style={{ maxWidth: 160 }}>
                <img src={form.coverResult.preview_url} alt="Cover" className="w-full object-cover" />
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* ── Audio Section ── */}
      <Collapsible title="Audio" defaultOpen={false}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#FAFAF8] border border-[#E8E6E1] px-4 py-3">
            <Music className="h-4 w-4 text-[#9E9E9E]" />
            <p className="text-[12px] text-[#9E9E9E]">
              {form.audioTrack ? form.audioTrack.title : "Original audio will be used"}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="h-3.5 w-3.5 text-[#9E9E9E]" />
              <span className="text-[12px] text-[#6B6B6B]">Original Audio</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.originalAudioVolume}
              onChange={(e) => patch({ originalAudioVolume: Number(e.target.value) })}
              className="w-full accent-[#7C5CFC]"
            />
          </div>
          {form.audioTrack && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="h-3.5 w-3.5 text-[#9E9E9E]" />
                <span className="text-[12px] text-[#6B6B6B]">Overlay Audio</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={form.overlayAudioVolume}
                onChange={(e) => patch({ overlayAudioVolume: Number(e.target.value) })}
                className="w-full accent-[#7C5CFC]"
              />
            </div>
          )}
        </div>
      </Collapsible>

      {/* ── Tags (people) ── */}
      <div>
        <FieldLabel label="Tag People" hint="@mention collaborators" />
        <StudioInput
          value={form.tags.join(", ")}
          onChange={(v) => patch({ tags: v.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="@username1, @username2"
        />
      </div>
    </div>
  );
}
