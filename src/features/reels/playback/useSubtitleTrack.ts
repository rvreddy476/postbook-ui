"use client";

import { useEffect, useState } from "react";

import { fetchSubtitles, type SubtitleTrack } from "@/features/reels/data/reelFeedApi";

/*
  Turns the media-service transcript into something a <track> can play.
  Fetched only when captions are switched on; a transcript delivered inline
  becomes a Blob URL (no second authenticated request), a `content_url`
  is used as is. SRT is rewritten to WebVTT, which is the only format the
  browser renders.
*/

export interface CaptionSource {
  src: string;
  lang: string;
}

export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r/g, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}`;
}

function toSource(track: SubtitleTrack): CaptionSource | null {
  const lang = track.language || "en";
  const format = (track.format || "").toLowerCase();
  if (track.content) {
    const vtt = format === "srt" ? srtToVtt(track.content) : track.content.startsWith("WEBVTT") ? track.content : srtToVtt(track.content);
    const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
    return { src: url, lang };
  }
  if (track.content_url && format !== "srt") return { src: track.content_url, lang };
  return null;
}

export function useSubtitleTrack(mediaId: string, enabled: boolean) {
  const [source, setSource] = useState<CaptionSource | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "none">("idle");

  useEffect(() => {
    if (!enabled || !mediaId) {
      setSource(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setStatus("loading");
    fetchSubtitles(mediaId).then((tracks) => {
      if (cancelled) return;
      const first = tracks.map(toSource).find((s): s is CaptionSource => s !== null) ?? null;
      if (first?.src.startsWith("blob:")) objectUrl = first.src;
      setSource(first);
      setStatus(first ? "ready" : "none");
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, enabled]);

  return { source, status };
}
