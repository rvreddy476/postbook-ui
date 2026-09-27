"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Loader2, Sparkles, Trash2, Upload, X } from "lucide-react";

import { useGlobalToast } from "@/contexts/ToastContext";
import { apiErrorCode } from "@/features/reels/data/audioTracksApi";
import { useAudioTracks, useDeleteAudioTrack, useGenerateAudioTrack, useUploadAudioTrack } from "@/features/reels/hooks/useAudioTracks";
import { LANGUAGE_CHOICES, languageLabel, type ReelAudioTrack } from "@/features/reels/playback/audioTracks";

interface ReelAudioTracksDialogProps {
  open: boolean;
  mediaId: string;
  onClose: () => void;
}

const MAX_TRACKS = 10;

/*
  The creator's audio tracks for one reel: every track with its state, an
  upload form (an audio file for one language), and "Generate" for an AI
  dub when the server offers one. Viewers pick between ready tracks from
  the More menu. role="dialog", Escape closes, clicks never reach the stage.
*/
export function ReelAudioTracksDialog({ open, mediaId, onClose }: ReelAudioTracksDialogProps) {
  const toast = useGlobalToast();
  const tracks = useAudioTracks(mediaId, open);
  const upload = useUploadAudioTrack(mediaId);
  const generate = useGenerateAudioTrack(mediaId);
  const remove = useDeleteAudioTrack(mediaId);
  const [language, setLanguage] = useState("hi");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dubbing, setDubbing] = useState<"unknown" | "yes" | "no">("unknown");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const list = (tracks.data ?? []).filter((t) => t.source !== "original");
  const full = list.length >= MAX_TRACKS;
  const taken = new Set(list.map((t) => t.language.toLowerCase()));

  const explain = (err: unknown, fallback: string): string => {
    switch (apiErrorCode(err)) {
      case "AUDIO_DURATION_MISMATCH": return "That audio is not the same length as the video.";
      case "AUDIO_TRACK_LIMIT": return `A reel can carry up to ${MAX_TRACKS} audio tracks.`;
      case "AUDIO_TRACK_EXISTS": return "There is already a track in that language. Delete it first.";
      case "MEDIA_NOT_READY": return "The video is still processing. Try again in a moment.";
      case "DUBBING_UNAVAILABLE": return "Generated dubs are not switched on for this server yet.";
      case "413": return "That file is too large (50 MB max).";
      case "415": case "UNSUPPORTED_MEDIA_TYPE": return "That file type is not supported. Use m4a, mp3, wav, ogg or flac.";
      default: return fallback;
    }
  };

  const onUpload = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync({ file, language, label: label.trim() || undefined });
      setFile(null);
      setLabel("");
      if (fileInput.current) fileInput.current.value = "";
      toast({ type: "success", title: `${languageLabel(language)} track uploaded`, description: "It will be ready to play in a minute." });
    } catch (err) {
      toast({ type: "error", title: "Could not add that track", description: explain(err, "Please try again.") });
    }
  };

  const onGenerate = async () => {
    try {
      await generate.mutateAsync({ language });
      setDubbing("yes");
      toast({ type: "success", title: `Generating a ${languageLabel(language)} dub`, description: "This takes a few minutes." });
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "DUBBING_UNAVAILABLE" || code === "503") setDubbing("no");
      toast({ type: "error", title: "Could not generate the dub", description: explain(err, "Please try again.") });
    }
  };

  const onDelete = async (t: ReelAudioTrack) => {
    try {
      await remove.mutateAsync(t.id);
    } catch {
      toast({ type: "error", title: "Could not delete that track" });
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="reel-confirm-scrim"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="reel-audio-title"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="reel-confirm-card reel-audio-dialog"
          >
            <div className="flex items-center gap-2">
              <AudioLines className="h-5 w-5" aria-hidden />
              <h2 id="reel-audio-title" className="text-[15px] font-bold">Audio tracks</h2>
              <button type="button" aria-label="Close" onClick={onClose} className="ml-auto rounded-full p-1.5 text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-brand-text/70">Viewers pick a language from the reel's menu. Upload your own dub, or let us generate one.</p>

            <ul className="reel-audio-dialog__list" aria-label="Your audio tracks">
              <li className="reel-audio-dialog__track">
                <span className="reel-audio-dialog__name">Original</span>
                <span className="reel-audio-dialog__state" data-state="ready">Plays by default</span>
              </li>
              {list.map((t) => (
                <li key={t.id} className="reel-audio-dialog__track">
                  <span className="reel-audio-dialog__name">
                    {t.label || languageLabel(t.language)}
                    <span className="reel-audio-dialog__meta">{t.source === "generated" ? "Generated" : "Uploaded"} · {t.language}</span>
                  </span>
                  <span className="reel-audio-dialog__state" data-state={t.status} title={t.error}>
                    {t.status === "ready" ? "Ready" : t.status === "failed" ? "Failed" : <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.status === "processing" ? "Processing" : "Queued"}</>}
                  </span>
                  <button type="button" aria-label={`Delete ${t.label || t.language} track`} disabled={remove.isPending} onClick={() => void onDelete(t)} className="reel-audio-dialog__delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {tracks.isPending ? <li className="reel-audio-dialog__note">Loading…</li> : null}
            </ul>

            <div className="reel-audio-dialog__form">
              <label className="reel-audio-dialog__field">
                <span>Language</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGE_CHOICES.map((l) => (
                    <option key={l.tag} value={l.tag} disabled={taken.has(l.tag)}>{l.label}{taken.has(l.tag) ? " · added" : ""}</option>
                  ))}
                </select>
              </label>
              <label className="reel-audio-dialog__field">
                <span>Label (optional)</span>
                <input type="text" value={label} maxLength={60} placeholder={languageLabel(language)} onChange={(e) => setLabel(e.target.value)} />
              </label>
              <label className="reel-audio-dialog__field">
                <span>Audio file</span>
                <input ref={fileInput} type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.opus,.flac,.aac" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <div className="reel-audio-dialog__actions">
                <button type="button" disabled={!file || full || upload.isPending || taken.has(language)} onClick={() => void onUpload()} className="reel-confirm-button">
                  {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload track
                </button>
                <button type="button" disabled={full || generate.isPending || taken.has(language) || dubbing === "no"} onClick={() => void onGenerate()} className="reel-audio-dialog__generate">
                  {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate {languageLabel(language)} dub
                </button>
              </div>
              {dubbing === "no" ? <p className="reel-audio-dialog__note">Generated dubs are not available on this server yet. Uploads still work.</p> : null}
              {full ? <p className="reel-audio-dialog__note">This reel has the maximum of {MAX_TRACKS} audio tracks.</p> : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
