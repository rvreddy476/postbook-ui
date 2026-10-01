"use client";

import { useRef, useState } from "react";
import { Upload, FileVideo, X, CheckCircle2, AlertCircle, Film, Clock, HardDrive } from "lucide-react";
import type { StudioFormState } from "../types";
import { type ContentType } from "../tokens";
import { uploadLimits } from "../fileRules";

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
  const limits = uploadLimits(contentType);
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
    </div> : <div className="upload-selected-file">
      {form.videoPreviewUrl ? <video src={form.videoPreviewUrl} controls muted playsInline preload="metadata" aria-label="Selected video preview" /> : null}
      <div className="upload-file-row">
        <FileVideo aria-hidden="true" />
        <div><strong title={form.videoFile.name}>{form.videoFile.name}</strong><span>{(form.videoFile.size / (1024 * 1024)).toFixed(1)} MB{form.videoDurationSec != null ? ` · ${Math.floor(form.videoDurationSec / 60)}m ${form.videoDurationSec % 60}s` : ""}</span></div>
        <button id="upload-videoFile" type="button" className="upload-button" disabled={busy} onClick={() => fileRef.current?.click()}>Change</button>
        <button type="button" className="upload-icon-button" aria-label="Remove selected file" disabled={busy} onClick={clearFile}><X aria-hidden="true" /></button>
      </div>
      <p className="upload-file-ready" role="status"><CheckCircle2 aria-hidden="true" />{checking ? "Checking replacement file…" : "File selected. Continue to add a title and details."}</p>
    </div>}
    <ul id="upload-file-limits" className="upload-file-limits">
      <li><Film aria-hidden="true" />MP4, WebM, MOV{contentType === "podcast" ? " or audio" : ""}</li>
      <li><HardDrive aria-hidden="true" />Up to {limits.maxSize / (1024 * 1024)} MB</li>
      <li><Clock aria-hidden="true" />Up to {limits.maxDuration >= 3600 ? `${limits.maxDuration / 3600} hours` : `${limits.maxDuration / 60} minutes`}</li>
    </ul>
    {error ? <p id="upload-file-error" className="upload-field-error" role="alert"><AlertCircle aria-hidden="true" />{error}</p> : null}
  </div>;
}
