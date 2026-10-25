"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Circle, Eye, FileVideo, Heart, ListChecks, MessageCircle, Music, Play, Share2, ShieldCheck } from "lucide-react";

import { isShortStudio, type ContentType, type StepId } from "../tokens";
import type { StudioFormState } from "../types";
import { topicRequired } from "../validation";

interface PreviewPanelProps {
  form: StudioFormState;
  contentType: ContentType;
  steps: readonly StepId[];
  /** The channel the long video goes to, for the line under the title. */
  channelName?: string | null;
}

const COUNT_WORDS = ["no", "one", "two", "three", "four"];

/** The phone frame's video: a tap plays or pauses (native controls would sit under the caption). */
function PhoneVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };
  return <>
    <video ref={ref} src={src} poster={poster} muted playsInline loop preload="metadata" aria-label="Video preview"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    <button type="button" className="upload-phone-play" onClick={toggle} aria-label={playing ? "Pause preview" : "Play preview"}>
      {playing ? null : <Play aria-hidden="true" />}
    </button>
  </>;
}

/*
  The studio's right column (a card above the form on a phone, folded
  until opened). A reel previews in a 9:16 phone frame with its title,
  caption and sound over the video; a long video in a 16:9 card with the
  title and channel line under it. Under it, what is still required.
*/
export function PreviewPanel({ form, contentType, channelName }: PreviewPanelProps) {
  const short = isShortStudio(contentType);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const cover = form.coverSourceType === "custom_image" ? form.customCoverPreviewUrl : form.coverPreviewUrl;
  const title = form.title.trim();
  const requirements = [
    { title: "Video file", detail: "Choose a supported file", done: !!form.videoFile || !!form.mediaId },
    { title: "Title", detail: "Add a clear title in Details", done: !!title && form.title.length <= 100 },
    ...(topicRequired(form) ? [{ title: "Topic", detail: "Choose a topic in Publish", done: !!form.category }] : []),
  ];
  const left = requirements.filter((r) => !r.done).length;

  return <aside className="upload-preview" aria-label="Preview and checklist">
    <button type="button" className="upload-preview-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
      <Eye aria-hidden="true" />
      <span>{form.videoPreviewUrl ? "Preview" : "How it works"} · {left === 0 ? "ready to publish" : `${left} required ${left === 1 ? "item" : "items"} left`}</span>
      <ChevronDown aria-hidden="true" />
    </button>
    <div id={bodyId} className="upload-preview-body" data-collapsed={!open || undefined}>
      {form.videoPreviewUrl ? <section className="upload-side-card">
        <h2>Preview</h2>
        {short ? <>
          <div className="upload-phone" data-preview="vertical">
            <PhoneVideo src={form.videoPreviewUrl} poster={cover || undefined} />
            <div className="upload-phone-overlay">
              <strong>{title || "Your title will appear here"}</strong>
              {form.caption.trim() ? <p>{form.caption.trim()}</p> : null}
              <div className="upload-phone-sound"><Music aria-hidden="true" /><span>{form.audioTrack ? form.audioTrack.title : "Original audio"}</span></div>
            </div>
            <div className="upload-phone-rail" aria-hidden="true"><Heart /><MessageCircle /><Share2 /></div>
          </div>
          <p className="upload-preview-caption">Local preview · not published</p>
        </> : <div className="upload-preview-wide" data-preview="wide">
          <video src={form.videoPreviewUrl} poster={cover || undefined} controls muted playsInline preload="metadata" aria-label="Video preview" />
          <div className="upload-preview-meta">
            <span className="upload-preview-avatar" aria-hidden="true">{(channelName?.trim() || "Y").slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="upload-preview-title">{title || "Your title will appear here"}</p>
              <p className="upload-preview-sub">{channelName?.trim() || "Your channel"} · Local preview, not published</p>
            </div>
          </div>
        </div>}
      </section> : <section className="upload-side-card upload-guide">
        <span className="upload-guide-icon"><FileVideo aria-hidden="true" /></span>
        <h2>{short ? "From clip to reel" : "From file to published video"}</h2>
        <p>{short ? "Add your clip, give it a title, then choose who can watch." : "Add your file, fill in the details, then review who can watch before publishing."}</p>
        <div className="upload-guide-note"><ShieldCheck aria-hidden="true" /><span>You&apos;re in control. Your file stays on this device until you choose Save draft or Publish.</span></div>
      </section>}
      <section className="upload-side-card">
        <h2><ListChecks aria-hidden="true" />Before you publish</h2>
        <p className="upload-muted">These {COUNT_WORDS[requirements.length] ?? requirements.length} items are required.</p>
        <ul className="upload-checklist">{requirements.map((item) => <li key={item.title} data-complete={item.done || undefined}>
          {item.done ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
          <div><strong>{item.title}<span className="upload-sr-only">{item.done ? ", complete" : ", required"}</span></strong><span>{item.done ? "Added" : item.detail}</span></div>
        </li>)}</ul>
        <p className="upload-guide-footnote">{short ? "A caption, cover, sound and topic are optional." : "Subtitles, chapters, a custom cover and the other extras are optional."}</p>
      </section>
    </div>
  </aside>;
}
