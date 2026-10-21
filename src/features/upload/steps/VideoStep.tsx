"use client";

import { useRef, useState } from "react";
import { Upload, FileVideo, X, CheckCircle2, AlertCircle, Film, Clock, HardDrive, Info } from "lucide-react";
import type { StudioFormState } from "../types";
import { isShortStudio, type ContentType } from "../tokens";
import { shortsLongVideoNotice, uploadLimitLabels } from "../fileRules";

interface VideoStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  onFileSelected: (f: File) => void;
  clearFile: () => void;
  contentType: ContentType;
  showErrors?: boolean;
  checking?: boolean;
  disabled?: boolean;
}

export function VideoStep({ form, onFileSelected, clearFile, contentType, showErrors, checking, disabled }: VideoStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const limits = uploadLimitLabels(contentType);
  const longVideoNotice = form.videoFile ? shortsLongVideoNotice(contentType, form.videoDurationSec) : null;
  const error = dropError || form.uploadError || (showErrors && !form.videoFile ? "Choose a video file before continuing to Details." : null);
  const busy = disabled || checking;
  const select = (files: FileList | null) => {
    if (busy || !files?.length) return;
    if (files.length !== 1) { setDropError("Choose one file at a time. You can upload another after this one."); return; }
    setDropError(null);
    onFileSelected(files[0]);
  };
  return <div className="upload-video-step">
    <input ref={fileRef} type="file" aria-label="Select video file" className="upload-file-input" tabIndex={-1}
      accept={contentType === "podcast" ? "video/mp4,video/webm,video/quicktime,audio/*" : "video/mp4,video/webm,video/quicktime"}
      disabled={busy} onChange={(e) => { select(e.target.files); e.target.value = ""; }} />
    {!form.videoFile ? <div className="upload-dropzone" data-dragging={dragging || undefined} data-error={!!error || undefined}
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); select(e.dataTransfer.files); }}>
      <span className="upload-drop-icon"><Upload aria-hidden="true" /></span>
      <h3>{checking ? "Checking your file…" : "Choose your video"}</h3>
      <p>Drag a file here, or browse from your device.</p>
      <button type="button" id="upload-videoFile" className="upload-button upload-button-primary" disabled={busy}
        aria-invalid={!!error} aria-describedby={error ? "upload-file-error upload-file-limits" : "upload-file-limits"}
        onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" />{checking ? "Checking file…" : "Select file"}</button>
      <span className="upload-local-note">Selecting a file does not upload or publish it.</span>
    </div> : <div className="upload-selected-file" data-vertical={isShortStudio(contentType) || undefined}>
      {form.videoPreviewUrl ? <video src={form.videoPreviewUrl} controls muted playsInline preload="metadata" aria-label="Selected video preview" /> : null}
      <div className="upload-file-row">
        <FileVideo aria-hidden="true" />
        <div><strong title={form.videoFile.name}>{form.videoFile.name}</strong><span>{fileSizeLabel(form.videoFile.size)}{form.videoDurationSec != null ? ` · ${Math.floor(form.videoDurationSec / 60)}m ${form.videoDurationSec % 60}s` : ""}</span></div>
        <button id="upload-videoFile" type="button" className="upload-button" disabled={busy} onClick={() => fileRef.current?.click()}>Change</button>
        <button type="button" className="upload-icon-button" aria-label="Remove selected file" disabled={busy} onClick={clearFile}><X aria-hidden="true" /></button>
      </div>
      <p className="upload-file-ready" role="status"><CheckCircle2 aria-hidden="true" />{checking ? "Checking replacement file…" : "File selected. Continue to add a title and details."}</p>
    </div>}
    <ul id="upload-file-limits" className="upload-file-limits">
      <li><Film aria-hidden="true" />MP4, WebM, MOV{contentType === "podcast" ? " or audio" : ""}</li>
      <li><HardDrive aria-hidden="true" />{limits.size}</li>
      <li><Clock aria-hidden="true" />{limits.duration}</li>
    </ul>
    {longVideoNotice ? <LongVideoNotice text={longVideoNotice} /> : null}
    {error ? <p id="upload-file-error" className="upload-field-error" role="alert"><AlertCircle aria-hidden="true" />{error}</p> : null}
  </div>;
}

/** A Short over the boundary is not an error: it is posted as a long video, and the studio says so. */
export function LongVideoNotice({ text }: { text: string }) {
  return <p className="upload-banner" role="status" data-long-video-notice><Info aria-hidden="true" />{text}</p>;
}

/** 734.2 MB, 2.4 GB — a multi-GB long video reads in GB. */
export function fileSizeLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}
