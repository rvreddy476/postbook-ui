"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Film, Image as ImageIcon, Loader2, MapPin, Music, Scissors } from "lucide-react";

import { CategoryOverride } from "@/features/posttube/components/CategoryOverride";
import { TrimControls } from "@/features/posttube/components/TrimControls";
import type { SoundInfo } from "@/features/reels/sounds";

import { LocationField } from "../components/LocationField";
import { StudioSoundSection } from "../components/StudioSoundSection";
import { Collapsible, FieldLabel, Section, StudioInput, TagChip } from "../primitives";
import { isShortStudio, type ContentType } from "../tokens";
import { shortsLongVideoNotice } from "../fileRules";
import { LongVideoNotice } from "./VideoStep";
import type { StudioFormState } from "../types";

interface DetailsStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  extractCoverPreview: { mutate: (ts: number) => void; isPending: boolean };
  selectCustomCover: (f: File) => void;
  contentType: ContentType;
  showErrors?: boolean;
  /** One line when the sound asked for in the address cannot be used. */
  soundNotice?: string | null;
  /** Takes the chosen sound off the reel. */
  onRemoveSound?: () => void;
  /** Puts a sound picked in the Audio section on the reel. */
  onChooseSound?: (sound: SoundInfo) => void;
}

/** Only short-form videos carry an added sound; long videos keep their own audio. */
export function takesAddedSound(contentType: ContentType): boolean {
  return isShortStudio(contentType);
}

const MAX_TITLE = 100;
const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 30;
/** post-service CreatePostRequest: tags max=20, each max=50. */
const MAX_TAGS = 20;

function fmtMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

/** Hashtags typed in a caption, as the server will read them. */
export function captionHashtags(caption: string): string[] {
  return [...new Set((caption.match(/#\w+/g) ?? []).map((t) => t.toLowerCase()))].slice(0, MAX_HASHTAGS);
}

/** Comma-separated keywords → the tags list (trimmed, no blanks, capped as the server caps them). */
export function parseTags(raw: string): string[] {
  return raw.split(",").map((s) => s.trim().slice(0, 50)).filter(Boolean).slice(0, MAX_TAGS);
}

export function DetailsStep({ form, patch, extractCoverPreview, selectCustomCover, contentType, showErrors, soundNotice = null, onRemoveSound, onChooseSound }: DetailsStepProps) {
  // The Audio section opens by itself once there is a sound (or a word about one) to show,
  // and stays as the creator left it afterwards: removing the sound does not fold it away.
  const audioWorthOpening = Boolean(form.audioTrack) || Boolean(soundNotice);
  const [audioOpened, setAudioOpened] = useState(audioWorthOpening);
  useEffect(() => {
    if (audioWorthOpening) setAudioOpened(true);
  }, [audioWorthOpening]);
  const short = isShortStudio(contentType);
  const isLongStudio = !short;

  const titleError = showErrors && !form.title.trim();
  const captionOverflow = form.caption.length > MAX_CAPTION;
  const typedTags = captionHashtags(form.caption);
  const longVideoNotice = shortsLongVideoNotice(contentType, form.videoDurationSec);

  return (
    <div className="upload-stack">
      {longVideoNotice ? <LongVideoNotice text={longVideoNotice} /> : null}
      <Section title={short ? "Title and caption" : "Title and description"}>
        {/* ── Title ── */}
        <div className="upload-field">
          <FieldLabel htmlFor="upload-title" label="Title" required counter={`${form.title.length}/${MAX_TITLE}`} />
          <input
            id="upload-title"
            required
            aria-invalid={!!titleError}
            aria-describedby={titleError ? "upload-title-error" : "upload-title-hint"}
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={short ? "What is this reel about?" : "A title that says what the video is about"}
            maxLength={MAX_TITLE}
            className="upload-input"
          />
          {titleError ? (
            <p id="upload-title-error" className="upload-field-error" role="alert">
              <AlertCircle aria-hidden="true" />
              Add a title so viewers know what your video is about.
            </p>
          ) : (
            <p id="upload-title-hint" className="upload-input-hint">A clear, specific title helps viewers know what to expect.</p>
          )}
        </div>

        {/* ── Caption / description ── */}
        <div className="upload-field">
          <FieldLabel htmlFor="upload-caption" label={short ? "Caption (optional)" : "Description (optional)"} counter={`${form.caption.length}/${MAX_CAPTION}`} />
          <textarea
            id="upload-caption"
            aria-invalid={captionOverflow || undefined}
            aria-describedby={captionOverflow ? "upload-caption-error" : "upload-caption-hint"}
            value={form.caption}
            onChange={(e) => patch({ caption: e.target.value })}
            placeholder={short ? "Say something about it. Add #hashtags and @mentions." : "Tell viewers about your video. Use #hashtags and @mentions."}
            maxLength={MAX_CAPTION}
            rows={short ? 4 : 6}
            className="upload-input"
          />
          {captionOverflow ? (
            <p id="upload-caption-error" className="upload-field-error" role="alert">
              <AlertCircle aria-hidden="true" />
              {short ? "Caption" : "Description"} must be {MAX_CAPTION} characters or less
            </p>
          ) : (
            <p id="upload-caption-hint" className="upload-input-hint">
              {short
                ? typedTags.length > 0 ? `Hashtags: ${typedTags.join(" ")}` : "Type #hashtags in the caption to help people find it."
                : "Timestamps like 00:00 Intro become chapters."}
            </p>
          )}
        </div>
      </Section>

      {isLongStudio ? <LongVideoKeywords form={form} patch={patch} /> : null}

      {/* ── Cover ── */}
      {form.videoPreviewUrl && contentType !== "podcast" ? (
        <Section title="Cover" subtitle={short ? "The still people see before it plays" : "The thumbnail people see before they click"} icon={ImageIcon}>
          <CoverPicker form={form} patch={patch} extractCoverPreview={extractCoverPreview} selectCustomCover={selectCustomCover} vertical={short} />
        </Section>
      ) : null}

      {form.uploadError ? <p className="upload-field-error" role="alert"><AlertCircle aria-hidden="true" />{form.uploadError}</p> : null}

      {/* ── Sound (reels only: a long video keeps its own audio) ── */}
      {takesAddedSound(contentType) ? (
        <Section title="Sound" subtitle="Optional. Add a sound and mix it with the original audio" icon={Music}>
          <Collapsible key={audioOpened ? "audio-open" : "audio"} title="Audio" defaultOpen={audioOpened}>
            <StudioSoundSection
              form={form}
              patch={patch}
              notice={soundNotice}
              onRemove={onRemoveSound ?? (() => patch({ audioTrack: null, audioStartMs: 0 }))}
              onChoose={takesAddedSound(contentType) ? onChooseSound : undefined}
            />
          </Collapsible>
        </Section>
      ) : null}

      {/* ── Video tools (long video: trim and the final category) ── */}
      {isLongStudio && form.videoDurationSec != null ? <LongVideoTools form={form} patch={patch} /> : null}

      {/* ── Location (location_name / location_place_id) ── */}
      <Section title="Location" subtitle="Optional. Shown on the post" icon={MapPin}>
        <label htmlFor="upload-location" className="upload-sr-only">Location</label>
        <LocationField
          name={form.locationName}
          placeId={form.locationPlaceId}
          onChange={({ name, placeId }) => patch({ locationName: name, locationPlaceId: placeId })}
        />
      </Section>
    </div>
  );
}

/* ── Long video: hashtags and keyword tags ─────────────── */

function LongVideoKeywords({ form, patch }: Pick<DetailsStepProps, "form" | "patch">) {
  // The tags field is edited as text; the list is what is stored (posts.tags).
  const [tagsText, setTagsText] = useState(form.tags.join(", "));
  const addHashtag = useCallback(() => {
    const raw = form.hashtagInput.trim().replace(/^#/, "").toLowerCase();
    if (!raw || form.hashtags.includes(`#${raw}`)) return;
    if (form.hashtags.length >= MAX_HASHTAGS) return;
    patch({ hashtags: [...form.hashtags, `#${raw}`], hashtagInput: "" });
  }, [form.hashtagInput, form.hashtags, patch]);

  return (
    <Section title="Hashtags and tags" subtitle="Optional. Both help people find your video">
      <div className="upload-field">
        <FieldLabel htmlFor="upload-hashtags" label="Hashtags" hint={`${form.hashtags.length}/${MAX_HASHTAGS}`} />
        <div className="upload-inline">
          <input
            id="upload-hashtags"
            value={form.hashtagInput}
            onChange={(e) => patch({ hashtagInput: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHashtag();
              }
            }}
            placeholder="Type a hashtag and press Enter"
            className="upload-input"
          />
          <button type="button" onClick={addHashtag} disabled={form.hashtags.length >= MAX_HASHTAGS} className="upload-button">
            Add
          </button>
        </div>
        {form.hashtags.length > 0 ? (
          <div className="upload-chips">
            {form.hashtags.map((tag) => (
              <TagChip key={tag} label={tag} onRemove={() => patch({ hashtags: form.hashtags.filter((t) => t !== tag) })} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="upload-field">
        <FieldLabel htmlFor="upload-tags" label="Tags" hint={`${form.tags.length}/${MAX_TAGS}`} />
        <StudioInput
          id="upload-tags"
          value={tagsText}
          onChange={(v) => {
            setTagsText(v);
            patch({ tags: parseTags(v) });
          }}
          describedBy="upload-tags-hint"
          placeholder="cooking, street food, hyderabad"
        />
        <p id="upload-tags-hint" className="upload-input-hint">Keywords that help people find this video. Separate them with commas.</p>
      </div>
    </Section>
  );
}

/* ── Long video: trim and category ─────────────────────── */

function LongVideoTools({ form, patch }: Pick<DetailsStepProps, "form" | "patch">) {
  const durationSec = form.videoDurationSec ?? 0;
  const totalDurationMs = Math.floor(durationSec * 1000);
  const orientation = form.videoWidth && form.videoHeight
    ? form.videoWidth > form.videoHeight
      ? "landscape"
      : form.videoWidth === form.videoHeight
        ? "square"
        : "portrait"
    : "portrait";
  const computedCategory = form.computedVideoCategory ?? "long_video";
  const currentCategory = form.finalVideoCategory ?? computedCategory;
  return (
    <Section title="Video tools" subtitle="Trim the start or end, and check where it is published" icon={Scissors}>
      <div className="grid gap-4">
        <TrimControls
          durationSeconds={durationSec}
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
          durationSeconds={durationSec}
          orientation={orientation}
          onCategoryChange={(category) => patch({ finalVideoCategory: category })}
        />
      </div>
    </Section>
  );
}

/* ── Cover: a frame from the video, or an image ────────── */

function CoverPicker({
  form,
  patch,
  extractCoverPreview,
  selectCustomCover,
  vertical,
}: Pick<DetailsStepProps, "form" | "patch" | "extractCoverPreview" | "selectCustomCover"> & { vertical: boolean }) {
  const coverFileRef = useRef<HTMLInputElement>(null);
  const durationMs = (form.videoDurationSec ?? 0) * 1000;
  const at = form.coverTimestampMs ?? 0;
  const pastEnd = form.coverTimestampMs != null && form.videoDurationSec != null && form.coverTimestampMs > durationMs;
  const setAt = (ms: number) => patch({ coverTimestampMs: Math.max(0, Math.min(ms, durationMs)) });
  const mins = Math.floor(at / 60000);
  const secs = Math.floor((at % 60000) / 1000);

  return (
    <div className="grid gap-4">
      <div className="upload-segmented" role="group" aria-label="Cover source">
        <button type="button" aria-pressed={form.coverSourceType === "video_frame"} onClick={() => patch({ coverSourceType: "video_frame" })}>
          <Film aria-hidden="true" />
          Frame from video
        </button>
        <button type="button" aria-pressed={form.coverSourceType === "custom_image"} onClick={() => patch({ coverSourceType: "custom_image" })}>
          <ImageIcon aria-hidden="true" />
          Upload an image
        </button>
      </div>

      {form.coverSourceType === "video_frame" ? (
        <div className="grid gap-3">
          <label htmlFor="upload-cover-at" className="upload-label"><span>Frame at {fmtMs(at)}</span><span className="upload-label-meta">of {fmtMs(durationMs)}</span></label>
          <input
            id="upload-cover-at"
            type="range"
            min={0}
            max={durationMs || 30000}
            step={100}
            value={at}
            onChange={(e) => setAt(Number(e.target.value))}
            className="upload-range"
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="upload-time-inputs">
              <label>
                Min
                <input type="number" min={0} max={Math.floor((form.videoDurationSec ?? 0) / 60)} value={mins} onChange={(e) => setAt(Math.max(0, parseInt(e.target.value) || 0) * 60000 + secs * 1000)} className="upload-input" />
              </label>
              <span aria-hidden="true">:</span>
              <label>
                Sec
                <input type="number" min={0} max={59} value={secs} onChange={(e) => setAt(mins * 60000 + Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) * 1000)} className="upload-input" />
              </label>
            </div>
            <button
              type="button"
              onClick={() => extractCoverPreview.mutate(at)}
              disabled={extractCoverPreview.isPending || pastEnd}
              className="upload-button"
            >
              {extractCoverPreview.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}
              Use this frame
            </button>
          </div>
          {pastEnd ? (
            <p className="upload-field-error" role="alert">
              <AlertCircle aria-hidden="true" />
              The video is only {fmtMs(durationMs)} long.
            </p>
          ) : null}
          {form.coverPreviewUrl ? (
            <div className="upload-cover-thumb" data-vertical={vertical || undefined}>
              <img src={form.coverPreviewUrl} alt="Cover preview" />
              <p>Uploaded when you publish</p>
            </div>
          ) : (
            <p className="upload-input-hint">Pick a moment, then press Use this frame.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="upload-row-desc">
            {vertical ? "720×1280 (9:16) works best. JPEG, PNG or WebP, up to 10 MB." : "1280×720 (16:9) works best. JPEG, PNG or WebP, up to 10 MB."}
          </p>
          <div>
            <button type="button" onClick={() => coverFileRef.current?.click()} className="upload-button">
              <ImageIcon aria-hidden="true" />
              {form.customCoverPreviewUrl ? "Choose another image" : "Choose an image"}
            </button>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Cover image file"
              tabIndex={-1}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) selectCustomCover(f); e.target.value = ""; }}
              className="upload-file-input"
            />
          </div>
          {form.customCoverPreviewUrl ? (
            <div className="upload-cover-thumb" data-vertical={vertical || undefined}>
              <img src={form.customCoverPreviewUrl} alt="Custom cover" />
              <p>Uploaded when you publish</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
