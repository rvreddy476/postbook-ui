"use client";

import { useCallback, useRef } from "react";
import { Image as ImageIcon, Loader2, Music, Volume2, Film, AlertCircle } from "lucide-react";
import { SectionHeader, FieldLabel, TagChip, StudioInput, Collapsible } from "../primitives";
import type { StudioFormState } from "../types";
import type { ContentType } from "../tokens";
import { TrimControls } from "@/features/posttube/components/TrimControls";
import { CategoryOverride } from "@/features/posttube/components/CategoryOverride";

interface DetailsStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  extractCoverPreview: { mutate: (ts: number) => void; isPending: boolean };
  selectCustomCover: (f: File) => void;
  contentType: ContentType;
  showErrors?: boolean;
}

function fmtMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

export function DetailsStep({ form, patch, extractCoverPreview, selectCustomCover, contentType, showErrors }: DetailsStepProps) {
  const coverFileRef = useRef<HTMLInputElement>(null);
  const isLongStudio = contentType === "long" || contentType === "podcast";
  const totalDurationMs = Math.floor((form.videoDurationSec ?? 0) * 1000);
  const orientation = form.videoWidth && form.videoHeight
    ? form.videoWidth > form.videoHeight
      ? "landscape"
      : form.videoWidth === form.videoHeight
        ? "square"
        : "portrait"
    : "portrait";
  const computedCategory = form.computedVideoCategory ?? "long_video";
  const currentCategory = form.finalVideoCategory ?? computedCategory;

  const titleError = showErrors && !form.title.trim();
  const captionOverflow = form.caption.length > 2200;

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

  const handleHashtagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addHashtag();
      }
    },
    [addHashtag],
  );

  return (
    <div className="space-y-6">
      {/* ── Title ── */}
      <div>
        <FieldLabel label="Title" required counter={`${form.title.length}/100`} />
        <input
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Add a title that describes your content"
          maxLength={100}
          autoFocus
          className={`h-12 w-full rounded-xl border px-4 text-[14px] text-[#1A1A1A] placeholder:text-[#BFBFBF] outline-none transition-all ${
            titleError
              ? "border-[#E8527A] bg-[#E8527A]/5 focus:border-[#E8527A] focus:ring-2 focus:ring-[#E8527A]/10"
              : "border-[#E8E6E1] bg-[#FAFAF8] focus:border-[#7C5CFC] focus:bg-brand-card focus:ring-2 focus:ring-[#7C5CFC]/10"
          }`}
        />
        {titleError && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#E8527A]">
            <AlertCircle className="h-3 w-3" />
            Title is required
          </div>
        )}
      </div>

      {/* ── Caption ── */}
      <div>
        <FieldLabel
          label="Caption / Description"
          counter={`${form.caption.length}/2200`}
        />
        <textarea
          value={form.caption}
          onChange={(e) => patch({ caption: e.target.value })}
          placeholder="Tell viewers about your content. Use #hashtags and @mentions."
          maxLength={2200}
          rows={5}
          className={`w-full rounded-xl border px-4 py-3 text-[13px] text-[#1A1A1A] placeholder:text-[#BFBFBF] outline-none resize-none transition-all ${
            captionOverflow
              ? "border-[#E8527A] bg-[#E8527A]/5 focus:border-[#E8527A] focus:ring-2 focus:ring-[#E8527A]/10"
              : "border-[#E8E6E1] bg-[#FAFAF8] focus:border-[#7C5CFC] focus:bg-brand-card focus:ring-2 focus:ring-[#7C5CFC]/10"
          }`}
        />
        {captionOverflow && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#E8527A]">
            <AlertCircle className="h-3 w-3" />
            Description exceeds 2200 character limit
          </div>
        )}
      </div>

      {/* ── Hashtags ── */}
      <div>
        <FieldLabel label="Hashtags" hint={`${form.hashtags.length}/30`} />
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              value={form.hashtagInput}
              onChange={(e) => patch({ hashtagInput: e.target.value })}
              onKeyDown={handleHashtagKeyDown}
              placeholder="Type a hashtag and press Enter"
              className="h-11 w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-4 text-[14px] text-[#1A1A1A] placeholder:text-[#BFBFBF] outline-none focus:border-[#7C5CFC] focus:bg-brand-card focus:ring-2 focus:ring-[#7C5CFC]/10 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={addHashtag}
            disabled={form.hashtags.length >= 30}
            className="shrink-0 rounded-xl bg-[#F5F4F1] px-4 text-[12px] font-semibold text-[#6B6B6B] hover:bg-[#E8E6E1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
        {form.hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {form.hashtags.map((tag) => (
              <TagChip key={tag} label={tag} onRemove={() => removeHashtag(tag)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Cover Poster ── */}
      {isLongStudio && form.videoDurationSec != null && (
        <div className="space-y-4">
          <SectionHeader
            title="Video Tools"
            subtitle="Adjust trim and final category before the video goes live"
          />

          <TrimControls
            durationSeconds={form.videoDurationSec}
            initialStartMs={form.trimStartMs}
            initialEndMs={form.trimEndMs ?? totalDurationMs}
            onTrimChange={(startMs, endMs) => patch({
              trimStartMs: startMs,
              trimEndMs: endMs >= totalDurationMs ? null : endMs,
            })}
          />

          <CategoryOverride
            computedCategory={computedCategory}
            currentCategory={currentCategory}
            durationSeconds={form.videoDurationSec}
            orientation={orientation}
            onCategoryChange={(category) => patch({ finalVideoCategory: category })}
          />
        </div>
      )}

      {form.videoPreviewUrl && contentType !== "podcast" && (
        <Collapsible title="Cover Poster" defaultOpen>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => patch({ coverSourceType: "video_frame" })}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all ${
                  form.coverSourceType === "video_frame"
                    ? "bg-[#7C5CFC] text-white shadow-sm"
                    : "bg-[#F5F4F1] text-[#6B6B6B] hover:bg-[#E8E6E1]"
                }`}
              >
                <Film className="h-3.5 w-3.5" />
                Frame from Video
              </button>
              <button
                type="button"
                onClick={() => patch({ coverSourceType: "custom_image" })}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all ${
                  form.coverSourceType === "custom_image"
                    ? "bg-[#7C5CFC] text-white shadow-sm"
                    : "bg-[#F5F4F1] text-[#6B6B6B] hover:bg-[#E8E6E1]"
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Upload Custom
              </button>
            </div>

            {/* Frame from Video */}
            {form.coverSourceType === "video_frame" && (
              <div className="space-y-3">
                <p className="text-[12px] text-[#9E9E9E]">Select a timestamp to use as the cover frame</p>

                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] text-[#9E9E9E] mb-1">Min</label>
                    <input
                      type="number"
                      min={0}
                      max={Math.floor((form.videoDurationSec ?? 0) / 60)}
                      value={Math.floor((form.coverTimestampMs ?? 0) / 60000)}
                      onChange={(e) => {
                        const mins = Math.max(0, parseInt(e.target.value) || 0);
                        const currentMs = form.coverTimestampMs ?? 0;
                        const secs = Math.floor((currentMs % 60000) / 1000);
                        const ms = currentMs % 1000;
                        const newMs = Math.min(mins * 60000 + secs * 1000 + ms, (form.videoDurationSec ?? 0) * 1000);
                        patch({ coverTimestampMs: newMs });
                      }}
                      className="w-14 rounded-lg border border-[#E8E6E1] bg-[#FAFAF8] px-2 py-2 text-center font-mono text-[13px] text-[#1A1A1A] focus:border-[#7C5CFC] focus:outline-none"
                    />
                  </div>
                  <span className="mt-4 text-[14px] font-bold text-[#9E9E9E]">:</span>
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] text-[#9E9E9E] mb-1">Sec</label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={Math.floor(((form.coverTimestampMs ?? 0) % 60000) / 1000)}
                      onChange={(e) => {
                        const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                        const currentMs = form.coverTimestampMs ?? 0;
                        const mins = Math.floor(currentMs / 60000);
                        const ms = currentMs % 1000;
                        const newMs = Math.min(mins * 60000 + secs * 1000 + ms, (form.videoDurationSec ?? 0) * 1000);
                        patch({ coverTimestampMs: newMs });
                      }}
                      className="w-14 rounded-lg border border-[#E8E6E1] bg-[#FAFAF8] px-2 py-2 text-center font-mono text-[13px] text-[#1A1A1A] focus:border-[#7C5CFC] focus:outline-none"
                    />
                  </div>
                  <span className="mt-4 text-[14px] font-bold text-[#9E9E9E]">.</span>
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] text-[#9E9E9E] mb-1">Ms</label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      step={100}
                      value={(form.coverTimestampMs ?? 0) % 1000}
                      onChange={(e) => {
                        const ms = Math.min(999, Math.max(0, parseInt(e.target.value) || 0));
                        const currentMs = form.coverTimestampMs ?? 0;
                        const base = currentMs - (currentMs % 1000);
                        const newMs = Math.min(base + ms, (form.videoDurationSec ?? 0) * 1000);
                        patch({ coverTimestampMs: newMs });
                      }}
                      className="w-16 rounded-lg border border-[#E8E6E1] bg-[#FAFAF8] px-2 py-2 text-center font-mono text-[13px] text-[#1A1A1A] focus:border-[#7C5CFC] focus:outline-none"
                    />
                  </div>
                </div>

                {form.coverTimestampMs != null && form.videoDurationSec != null && form.coverTimestampMs > form.videoDurationSec * 1000 && (
                  <p className="text-[11px] text-[#E8527A] flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Timestamp exceeds video duration ({fmtMs(form.videoDurationSec * 1000)})
                  </p>
                )}

                <input
                  type="range"
                  min={0}
                  max={(form.videoDurationSec ?? 30) * 1000}
                  step={100}
                  value={form.coverTimestampMs ?? 0}
                  onChange={(e) => patch({ coverTimestampMs: Number(e.target.value) })}
                  className="w-full accent-[#7C5CFC]"
                />

                <button
                  type="button"
                  onClick={() => extractCoverPreview.mutate(form.coverTimestampMs ?? 0)}
                  disabled={extractCoverPreview.isPending || (form.coverTimestampMs != null && form.videoDurationSec != null && form.coverTimestampMs > form.videoDurationSec * 1000)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#7C5CFC] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#6A4AE8] disabled:opacity-40 transition-colors shadow-sm"
                >
                  {extractCoverPreview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  Extract Preview
                </button>

                {form.coverPreviewUrl && (
                  <div className="overflow-hidden rounded-xl border border-[#E8E6E1] shadow-sm" style={{ maxWidth: 260 }}>
                    <img src={form.coverPreviewUrl} alt="Cover preview" className="w-full object-cover" style={{ aspectRatio: "16/9" }} />
                    <p className="bg-[#FAFAF8] px-3 py-1.5 text-[10px] text-[#9E9E9E] text-center">
                      Preview — uploaded at publish time
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Custom Image */}
            {form.coverSourceType === "custom_image" && (
              <div className="space-y-3">
                <p className="text-[12px] text-[#9E9E9E]">Recommended: 1280x720 (16:9), JPEG/PNG/WebP, max 10 MB</p>
                <button
                  type="button"
                  onClick={() => coverFileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#7C5CFC] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#6A4AE8] transition-colors shadow-sm"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Choose Image
                </button>
                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) selectCustomCover(f); }}
                  className="hidden"
                />
                {form.customCoverPreviewUrl && (
                  <div className="overflow-hidden rounded-xl border border-[#E8E6E1] shadow-sm" style={{ maxWidth: 260 }}>
                    <img src={form.customCoverPreviewUrl} alt="Custom cover" className="w-full object-cover" style={{ aspectRatio: "16/9" }} />
                    <p className="bg-[#FAFAF8] px-3 py-1.5 text-[10px] text-[#9E9E9E] text-center">
                      Preview — uploaded at publish time
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* ── Audio ── */}
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
              <span className="ml-auto text-[11px] font-mono text-[#9E9E9E]">{Math.round(form.originalAudioVolume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
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
                <span className="ml-auto text-[11px] font-mono text-[#9E9E9E]">{Math.round(form.overlayAudioVolume * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05}
                value={form.overlayAudioVolume}
                onChange={(e) => patch({ overlayAudioVolume: Number(e.target.value) })}
                className="w-full accent-[#7C5CFC]"
              />
            </div>
          )}
        </div>
      </Collapsible>

      {/* ── Tags ── */}
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
