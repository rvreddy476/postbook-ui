"use client";

import { Check, Circle, FileVideo, ListChecks, ShieldCheck } from "lucide-react";
import type { ContentType, StepId } from "../tokens";
import type { StudioFormState } from "../types";

interface PreviewPanelProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  contentType: ContentType;
  steps: readonly StepId[];
}

export function PreviewPanel({ form, contentType }: PreviewPanelProps) {
  const vertical = contentType === "reel" || contentType === "short";
  const cover = form.coverSourceType === "custom_image" ? form.customCoverPreviewUrl : form.coverPreviewUrl;
  const requirements = [
    { title: "Video file", detail: "Choose a supported file", done: !!form.videoFile || !!form.mediaId },
    { title: "Title", detail: "Add a clear title in Details", done: !!form.title.trim() && form.title.length <= 100 },
    { title: "Topic", detail: "Choose a topic in Publish", done: !!form.category },
  ];
  return <aside className="upload-preview" aria-label="Upload guidance and preview">
    {form.videoPreviewUrl ? <section className="upload-side-card">
      <h2>Preview</h2>
      <div className="upload-preview-media" data-vertical={vertical || undefined}>
        <video src={form.videoPreviewUrl} poster={cover || undefined} controls muted playsInline preload="metadata" aria-label="Video preview" />
      </div>
      <p className="upload-preview-title">{form.title.trim() || "Your title will appear here"}</p>
      <span className="upload-muted">Local preview · not published</span>
    </section> : <section className="upload-side-card upload-guide">
      <span className="upload-guide-icon"><FileVideo aria-hidden="true" /></span>
      <h2>From file to published video</h2>
      <p>Add your file, fill in the details, then review who can watch before publishing.</p>
      <div className="upload-guide-note"><ShieldCheck aria-hidden="true" /><span>You're in control. Your file stays on this device until you choose Save draft or Publish.</span></div>
    </section>}
    <section className="upload-side-card">
      <h2><ListChecks aria-hidden="true" />Before you publish</h2>
      <p className="upload-muted">These three items are required.</p>
      <ul className="upload-checklist">{requirements.map((item) => <li key={item.title} data-complete={item.done || undefined}>
        {item.done ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
        <div><strong>{item.title}<span className="upload-sr-only">{item.done ? ", complete" : ", required"}</span></strong><span>{item.done ? "Added" : item.detail}</span></div>
      </li>)}</ul>
      <p className="upload-guide-footnote">Captions, a custom cover and other enhancements are optional. Review audience settings for your content.</p>
    </section>
  </aside>;
}
