"use client";

import { useCallback, useRef } from "react";
import { Upload, FileVideo, X, Loader2, CheckCircle2 } from "lucide-react";
import type { StudioFormState } from "../types";
import { CONTENT_TYPE_META, type ContentType } from "../tokens";

interface VideoStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  onFileSelected: (f: File) => void;
  clearFile: () => void;
  contentType: ContentType;
}

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function VideoStep({ form, patch, onFileSelected, clearFile, contentType }: VideoStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const config = CONTENT_TYPE_META[contentType];

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) onFileSelected(f);
    },
    [onFileSelected],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) onFileSelected(f);
    },
    [onFileSelected],
  );

  /* ── No file yet: show dropzone ── */
  if (!form.videoFile) {
    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E8E6E1] bg-[#FAFAF8] py-20 transition-colors hover:border-[#7C5CFC]/40 hover:bg-[#EDE9FE]/20"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F4F1] group-hover:bg-[#EDE9FE] transition-colors">
            <Upload className="h-7 w-7 text-[#9E9E9E] group-hover:text-[#7C5CFC]" />
          </div>
          <p className="mt-5 text-[15px] font-semibold text-[#1A1A1A]">Drag & drop your file here</p>
          <p className="mt-1.5 text-[13px] text-[#9E9E9E]">or click to browse</p>
          <p className="mt-4 text-[11px] text-[#BFBFBF]">
            {config.label} — max {config.maxSize >= 1024 * 1024 * 1024
              ? `${config.maxSize / (1024 * 1024 * 1024)} GB`
              : `${config.maxSize / (1024 * 1024)} MB`}
          </p>
          <input ref={fileRef} type="file" accept="video/*,audio/*" onChange={onFileChange} className="hidden" />
        </div>

        {form.uploadError && (
          <p className="text-center text-[12px] text-[#E8527A]">{form.uploadError}</p>
        )}
      </div>
    );
  }

  /* ── File selected: show upload progress ── */
  return (
    <div className="space-y-6">
      {/* File info card */}
      <div className="rounded-2xl border border-[#E8E6E1] bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7C5CFC]/10">
            <FileVideo className="h-5 w-5 text-[#7C5CFC]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-[#1A1A1A]">{form.videoFile.name}</p>
            <p className="text-[12px] text-[#9E9E9E]">
              {(form.videoFile.size / (1024 * 1024)).toFixed(1)} MB
              {form.videoDurationSec != null && ` · ${fmtDuration(form.videoDurationSec)}`}
            </p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} className="text-[12px] font-semibold text-[#7C5CFC] hover:text-[#6A4AE8]">
            Change
          </button>
          <button type="button" onClick={clearFile} className="flex h-7 w-7 items-center justify-center rounded-full text-[#9E9E9E] hover:bg-[#F5F4F1] hover:text-[#1A1A1A]">
            <X className="h-4 w-4" />
          </button>
          <input ref={fileRef} type="file" accept="video/*,audio/*" onChange={onFileChange} className="hidden" />
        </div>

        {/* Upload progress */}
        {form.uploadPhase === "uploading" && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-[#6B6B6B]">Uploading...</span>
              <span className="text-[12px] font-bold text-[#7C5CFC]">{form.uploadProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#E8E6E1] overflow-hidden">
              <div className="h-full rounded-full bg-[#7C5CFC] transition-all duration-300" style={{ width: `${form.uploadProgress}%` }} />
            </div>
          </div>
        )}

        {(form.uploadPhase === "confirming" || form.uploadPhase === "creating_draft") && (
          <div className="mt-4 flex items-center gap-2 text-[12px] text-[#9E9E9E]">
            <Loader2 className="h-4 w-4 animate-spin text-[#7C5CFC]" />
            Processing your file...
          </div>
        )}

        {form.uploadPhase === "done" && (
          <div className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-[#2BB5A0]">
            <CheckCircle2 className="h-4 w-4" />
            Upload complete — proceed to Details
          </div>
        )}

        {form.uploadPhase === "error" && form.uploadError && (
          <p className="mt-4 text-[12px] text-[#E8527A]">{form.uploadError}</p>
        )}
      </div>

      {/* Video preview */}
      {form.videoPreviewUrl && (
        <div className="overflow-hidden rounded-2xl border border-[#E8E6E1] bg-[#1A1A1A]">
          <video
            src={form.videoPreviewUrl}
            className="mx-auto max-h-[320px]"
            controls
            muted
            playsInline
            preload="metadata"
          />
        </div>
      )}
    </div>
  );
}
