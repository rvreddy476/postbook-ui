"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { publishBrowserLiveStream, stopBrowserLivePublishSession } from "@/features/live/api";

export type BrowserLivePublishStatus = "idle" | "requesting" | "publishing" | "stopping" | "error";

export interface UseBrowserLivePublisherResult {
  status: BrowserLivePublishStatus;
  error: string | null;
  isSupported: boolean;
  isPublishing: boolean;
  localStream: MediaStream | null;
  previewRef: RefObject<HTMLVideoElement | null>;
  publishUrl: string | null;
  sessionUrl: string | null;
  startPublishing: () => Promise<void>;
  stopPublishing: () => Promise<void>;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function getBrowserPublishError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Browser publish failed.";
}

function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs = 10_000) {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") {
        window.clearTimeout(timeoutId);
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }
    };

    const timeoutId = window.setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      reject(new Error("Timed out while preparing browser publish session."));
    }, timeoutMs);

    pc.addEventListener("icegatheringstatechange", onStateChange);
  });
}

function stopStreamTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useBrowserLivePublisher(publishUrl?: string | null): UseBrowserLivePublisherResult {
  const previewRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionUrlRef = useRef<string | null>(null);
  const statusRef = useRef<BrowserLivePublishStatus>("idle");

  const [status, setStatus] = useState<BrowserLivePublishStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof RTCPeerConnection !== "undefined";

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearPreview = useCallback(() => {
    const video = previewRef.current;
    if (video && video.srcObject) {
      video.srcObject = null;
    }
  }, []);

  const disposeResources = useCallback(
    async (closeRemoteSession: boolean) => {
      const pc = peerConnectionRef.current;
      peerConnectionRef.current = null;
      if (pc) {
        try {
          pc.onicecandidate = null;
          pc.onconnectionstatechange = null;
          pc.onicegatheringstatechange = null;
          pc.close();
        } catch {
          // Ignore cleanup errors.
        }
      }

      if (closeRemoteSession && sessionUrlRef.current) {
        try {
          await stopBrowserLivePublishSession(sessionUrlRef.current);
        } catch {
          // Ignore remote cleanup errors.
        }
      }

      sessionUrlRef.current = null;
      setSessionUrl(null);

      stopStreamTracks(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
      clearPreview();
    },
    [clearPreview],
  );

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;

    video.srcObject = localStream;
    if (localStream) {
      void video.play().catch(() => undefined);
    }

    return () => {
      if (video.srcObject === localStream) {
        video.srcObject = null;
      }
    };
  }, [localStream]);

  useEffect(() => {
    return () => {
      void disposeResources(true);
    };
  }, [disposeResources]);

  const startPublishing = useCallback(async () => {
    if (!publishUrl || statusRef.current === "requesting" || statusRef.current === "publishing" || statusRef.current === "stopping") {
      return;
    }

    if (!isSupported) {
      setStatus("error");
      setError("Browser publishing is not supported in this browser.");
      return;
    }

    try {
      setError(null);
      setStatus("requesting");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        bundlePolicy: "max-bundle",
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus("publishing");
          return;
        }
        if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
          if (statusRef.current !== "stopping") {
            setStatus("error");
            setError("Browser publish connection lost.");
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      const offerSdp = pc.localDescription?.sdp ?? offer.sdp ?? "";
      if (!offerSdp) {
        throw new Error("Failed to create browser publish offer.");
      }

      const result = await publishBrowserLiveStream({
        publishUrl,
        offerSdp,
      });

      sessionUrlRef.current = result.sessionUrl ?? null;
      setSessionUrl(result.sessionUrl ?? null);
      await pc.setRemoteDescription({
        type: "answer",
        sdp: result.answerSdp,
      });
      setStatus("publishing");
    } catch (publishError) {
      await disposeResources(true);
      setStatus("error");
      setError(getBrowserPublishError(publishError));
    }
  }, [disposeResources, isSupported, publishUrl]);

  const stopPublishing = useCallback(async () => {
    if (statusRef.current === "idle") {
      return;
    }

    setStatus("stopping");
    await disposeResources(true);
    setStatus("idle");
    setError(null);
  }, [disposeResources]);

  return {
    status,
    error,
    isSupported,
    isPublishing: status === "publishing" || status === "requesting",
    localStream,
    previewRef,
    publishUrl: publishUrl ?? null,
    sessionUrl,
    startPublishing,
    stopPublishing,
  };
}