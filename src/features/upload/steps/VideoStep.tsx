"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Upload, FileVideo, X, CheckCircle2, AlertCircle, Film, Clock, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { StudioFormState } from "../types";
import { CONTENT_TYPE_META, type ContentType } from "../tokens";

interface VideoStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  onFileSelected: (f: File) => void;
  clearFile: () => void;
  contentType: ContentType;
  showErrors?: boolean;
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/* ── Circular progress ring ── */
function CircleProgress({ progress, size = 120, stroke = 5 }: { progress: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.15)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="white" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}

/* ── Full overlay for upload states ── */
function UploadOverlay({ phase, progress, error }: { phase: string; progress: number; error: string | null }) {
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (phase === "done") {
      setShowDone(true);
      const t = setTimeout(() => setShowDone(false), 2500);
      return () => clearTimeout(t);
    }
    setShowDone(false);
  }, [phase]);

  const isActive = phase === "uploading" || phase === "confirming" || phase === "creating_draft";
  const isError = phase === "error";
  const visible = isActive || isError || showDone;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl"
        >
          {/* Blurred backdrop */}
          <div className="absolute inset-0 rounded-2xl bg-[#1A1A1A]/70 backdrop-blur-md" />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative flex flex-col items-center"
          >
            {/* Uploading — progress ring with percentage */}
            {phase === "uploading" && (
              <>
                <div className="relative">
                  <CircleProgress progress={progress} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[28px] font-bold text-white">{progress}</span>
                    <span className="text-[14px] font-medium text-white/60 mt-1">%</span>
                  </div>
                </div>
                <p className="mt-4 text-[13px] font-medium text-white/80">Uploading your video...</p>
              </>
            )}

            {/* Processing — pulsing ring */}
            {(phase === "confirming" || phase === "creating_draft") && (
              <>
                <div className="relative h-[120px] w-[120px]">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0"
                  >
                    <CircleProgress progress={75} />
                  </motion.div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    >
                      <FileVideo className="h-8 w-8 text-white" />
                    </motion.div>
                  </div>
                </div>
                <p className="mt-4 text-[13px] font-medium text-white/80">Processing...</p>
              </>
            )}

            {/* Done — checkmark burst */}
            {showDone && phase === "done" && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[#2BB5A0]/20 ring-4 ring-[#2BB5A0]/10">
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.15, type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <CheckCircle2 className="h-12 w-12 text-[#2BB5A0]" />
                    </motion.div>
                  </div>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 text-[14px] font-semibold text-white"
                >
                  Upload complete
                </motion.p>
              </>
            )}

            {/* Error */}
            {isError && (
              <>
                <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[#E8527A]/20 ring-4 ring-[#E8527A]/10">
                  <AlertCircle className="h-12 w-12 text-[#E8527A]" />
                </div>
                <p className="mt-4 text-[14px] font-semibold text-white">Upload failed</p>
                {error && <p className="mt-1 text-[12px] text-white/60 max-w-[240px] text-center">{error}</p>}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function VideoStep({ form, patch, onFileSelected, clearFile, contentType, showErrors }: VideoStepProps) {
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

  /* ── No file: dropzone ── */
  if (!form.videoFile) {
    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 transition-all ${
            showErrors && !form.videoFile
              ? "border-[#E8527A]/40 bg-[#E8527A]/5 hover:border-[#E8527A]/60"
              : "border-[#E8E6E1] bg-[#FAFAF8] hover:border-[#7C5CFC]/40 hover:bg-[#EDE9FE]/20"
          }`}
        >
          <div className={`flex h-18 w-18 items-center justify-center rounded-2xl transition-colors ${
            showErrors && !form.videoFile
              ? "bg-[#E8527A]/10"
              : "bg-[#F5F4F1] group-hover:bg-[#EDE9FE]"
          }`}>
            <Upload className={`h-8 w-8 transition-colors ${
              showErrors && !form.videoFile
                ? "text-[#E8527A]"
                : "text-[#9E9E9E] group-hover:text-[#7C5CFC]"
            }`} />
          </div>
          <p className="mt-5 text-[15px] font-semibold text-[#1A1A1A]">
            Drag & drop your {config.label.toLowerCase()} here
          </p>
          <p className="mt-1.5 text-[13px] text-[#9E9E9E]">
            or <span className="text-[#7C5CFC] font-medium">click to browse</span>
          </p>

          <div className="mt-6 flex items-center gap-4 text-[11px] text-[#BFBFBF]">
            <span className="flex items-center gap-1">
              <Film className="h-3 w-3" />
              MP4, WebM, MOV
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              Max {config.maxSize >= 1024 * 1024 * 1024 ? `${config.maxSize / (1024 * 1024 * 1024)} GB` : `${config.maxSize / (1024 * 1024)} MB`}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Max {config.maxDuration >= 3600 ? `${Math.floor(config.maxDuration / 3600)}h` : `${Math.floor(config.maxDuration / 60)}min`}
            </span>
          </div>

          <input ref={fileRef} type="file" accept="video/*,audio/*" onChange={onFileChange} className="hidden" />
        </div>

        {showErrors && !form.videoFile && (
          <div className="flex items-center gap-2 text-[12px] text-[#E8527A]">
            <AlertCircle className="h-3.5 w-3.5" />
            Please select a video file to continue
          </div>
        )}

        {form.uploadError && (
          <div className="flex items-center gap-2 rounded-xl bg-[#E8527A]/5 border border-[#E8527A]/20 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-[#E8527A] shrink-0" />
            <p className="text-[12px] text-[#E8527A]">{form.uploadError}</p>
          </div>
        )}
      </div>
    );
  }

  /* ── File selected — video preview with overlay status ── */
  return (
    <div className="relative">
      {/* Video preview / placeholder */}
      <div className="overflow-hidden rounded-2xl border border-[#E8E6E1] bg-[#1A1A1A] shadow-sm">
        {form.videoPreviewUrl ? (
          <video
            src={form.videoPreviewUrl}
            className="mx-auto max-h-[400px] w-full"
            controls
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="flex items-center justify-center py-32">
            <FileVideo className="h-12 w-12 text-white/20" />
          </div>
        )}

        {/* Upload overlay — blurred circle progress on top of video */}
        <UploadOverlay phase={form.uploadPhase} progress={form.uploadProgress} error={form.uploadError} />
      </div>

      {/* Minimal file info bar below video */}
      <div className="mt-3 flex items-center gap-3 px-1">
        <p className="truncate text-[12px] font-medium text-[#6B6B6B] flex-1">
          {form.videoFile.name}
          <span className="text-[#BFBFBF] ml-2">
            {fmtSize(form.videoFile.size)}
            {form.videoDurationSec != null && ` · ${fmtDuration(form.videoDurationSec)}`}
            {form.videoWidth && form.videoHeight && ` · ${form.videoWidth}×${form.videoHeight}`}
          </span>
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-[11px] font-semibold text-[#7C5CFC] hover:text-[#6A4AE8] transition-colors"
        >
          Change
        </button>
        <button
          type="button"
          onClick={clearFile}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#9E9E9E] hover:bg-[#F5F4F1] hover:text-[#1A1A1A] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <input ref={fileRef} type="file" accept="video/*,audio/*" onChange={onFileChange} className="hidden" />
      </div>
    </div>
  );
}
