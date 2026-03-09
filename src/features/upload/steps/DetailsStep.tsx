"use client";

import { useCallback } from "react";
import { Image as ImageIcon, Loader2, Music, Volume2 } from "lucide-react";
import { SectionHeader, FieldLabel, TagChip, StudioInput, StudioTextarea, Collapsible } from "../primitives";
import type { StudioFormState } from "../types";
import type { ContentType } from "../tokens";

interface DetailsStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  extractCoverMutation: { mutate: (ts: number) => void; isPending: boolean };
  contentType: ContentType;
}

function fmtMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

export function DetailsStep({ form, patch, extractCoverMutation, contentType }: DetailsStepProps) {
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
              autoFocus
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
