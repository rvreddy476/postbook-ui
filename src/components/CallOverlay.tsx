'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  subscribeToCallState,
  acceptCall,
  declineCall,
  endCall,
  toggleMute,
  toggleCamera,
  CallInfo,
} from '@/services/callService';

function useCallRingtone(state: string | undefined) {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state !== 'incoming' && state !== 'outgoing') {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (oscRef.current) { try { oscRef.current.stop(); } catch {} oscRef.current = null; }
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
      }
      ctxRef.current = null;
      gainRef.current = null;
      return;
    }

    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = 0;
    ctxRef.current = ctx;
    gainRef.current = gain;

    if (state === 'incoming') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 440;
      osc.connect(gain);
      osc.start();
      oscRef.current = osc;
      let on = true;
      gain.gain.value = 0.15;
      intervalRef.current = setInterval(() => {
        on = !on;
        gain.gain.value = on ? 0.15 : 0;
      }, on ? 300 : 200);
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 400;
      osc.connect(gain);
      osc.start();
      oscRef.current = osc;
      let on = true;
      gain.gain.value = 0.08;
      intervalRef.current = setInterval(() => {
        on = !on;
        gain.gain.value = on ? 0.08 : 0;
      }, on ? 1000 : 3000);
    }

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (oscRef.current) { try { oscRef.current.stop(); } catch {} oscRef.current = null; }
      if (ctx.state !== 'closed') { ctx.close().catch(() => {}); }
      ctxRef.current = null;
    };
  }, [state]);
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// Adaptive video quality based on network speed
function useAdaptiveQuality(localStream: MediaStream | undefined, isActive: boolean) {
  const lastAdjust = useRef(0);

  useEffect(() => {
    if (!localStream || !isActive) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const adjustQuality = async () => {
      const now = Date.now();
      if (now - lastAdjust.current < 5000) return; // throttle to every 5s
      lastAdjust.current = now;

      try {
        // Use Network Information API if available
        const conn = (navigator as any).connection;
        let targetHeight = 720;
        let targetFps = 30;

        if (conn) {
          const downlink = conn.downlink as number; // Mbps
          const effectiveType = conn.effectiveType as string;

          if (effectiveType === '4g' && downlink >= 5) {
            targetHeight = 1080; targetFps = 30;
          } else if (effectiveType === '4g' || downlink >= 2) {
            targetHeight = 720; targetFps = 30;
          } else if (effectiveType === '3g' || downlink >= 0.5) {
            targetHeight = 480; targetFps = 24;
          } else {
            targetHeight = 360; targetFps = 15;
          }
        }

        const constraints = videoTrack.getConstraints();
        const currentHeight = (constraints.height as ConstrainULongRange)?.ideal ||
          (typeof constraints.height === 'number' ? constraints.height : 720);

        if (currentHeight !== targetHeight) {
          await videoTrack.applyConstraints({
            width: { ideal: Math.round(targetHeight * 16 / 9) },
            height: { ideal: targetHeight },
            frameRate: { ideal: targetFps },
          });
        }
      } catch {
        // Constraints not supported — ignore
      }
    };

    adjustQuality();
    const id = setInterval(adjustQuality, 8000);
    return () => clearInterval(id);
  }, [localStream, isActive]);
}

const CallOverlay: React.FC = () => {
  const [info, setInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useCallRingtone(info?.state);
  useAdaptiveQuality(info?.localStream, info?.state === 'active');

  useEffect(() => {
    return subscribeToCallState(setInfo);
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (info?.state !== 'active' || !info.startedAt) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(Date.now() - info.startedAt!), 1000);
    return () => clearInterval(id);
  }, [info?.state, info?.startedAt]);

  // Attach local video
  useEffect(() => {
    if (localVideoRef.current && info?.localStream) {
      localVideoRef.current.srcObject = info.localStream;
    }
  }, [info?.localStream, info?.state, swapped]);

  // Attach remote video
  useEffect(() => {
    if (remoteVideoRef.current && info?.remoteStream) {
      remoteVideoRef.current.srcObject = info.remoteStream;
    }
  }, [info?.remoteStream, info?.state, swapped]);

  // Attach remote audio (audio-only calls)
  useEffect(() => {
    if (remoteAudioRef.current && info?.remoteStream) {
      remoteAudioRef.current.srcObject = info.remoteStream;
    }
  }, [info?.remoteStream, info?.state]);

  // Track fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleMute = useCallback(() => { setIsMuted(toggleMute()); }, []);
  const handleCamera = useCallback(() => { setIsCameraOff(toggleCamera()); }, []);

  const handleFullscreen = useCallback(() => {
    if (!overlayRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      overlayRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  // Double-tap to swap views
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setSwapped(s => !s);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, []);

  // Draggable PiP
  const handlePipPointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePipPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const maxX = window.innerWidth - 144;
    const maxY = window.innerHeight - 192;
    setPipPos({
      x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, maxX)),
      y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, maxY)),
    });
  }, [dragging]);

  const handlePipPointerUp = useCallback(() => { setDragging(false); }, []);

  // Reset PiP position on new call
  useEffect(() => {
    if (info?.state === 'outgoing' || info?.state === 'connecting') {
      setPipPos({ x: window.innerWidth - 144 - 24, y: 24 });
      setSwapped(false);
    }
  }, [info?.state]);

  if (!info) return null;

  const isVideo = info.type === 'video';
  const isActive = info.state === 'active';
  const isIncoming = info.state === 'incoming';
  const isOutgoing = info.state === 'outgoing';
  const isConnecting = info.state === 'connecting';

  // When swapped: local = fullscreen, remote = PiP
  const fullscreenStream = swapped ? info.localStream : info.remoteStream;
  const pipStream = swapped ? info.remoteStream : info.localStream;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-2xl"
        onClick={isVideo && isActive ? handleDoubleTap : undefined}
      >
        {/* Audio element for audio-only calls */}
        {!isVideo && <audio ref={remoteAudioRef} autoPlay playsInline />}

        {/* Fullscreen video (remote by default, local when swapped) */}
        {isVideo && (
          <video
            ref={swapped ? localVideoRef : remoteVideoRef}
            autoPlay
            playsInline
            muted={swapped}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isActive && fullscreenStream ? 'opacity-100' : 'opacity-0'
            }`}
            style={swapped ? { transform: 'scaleX(-1)' } : undefined}
          />
        )}

        {/* PiP video (local by default, remote when swapped) — draggable */}
        {isVideo && pipStream && (isActive || isConnecting || isOutgoing) && (
          <div
            onPointerDown={handlePipPointerDown}
            onPointerMove={handlePipPointerMove}
            onPointerUp={handlePipPointerUp}
            style={{
              position: 'absolute',
              left: pipPos.x,
              top: pipPos.y,
              zIndex: 20,
              cursor: dragging ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
            className="w-36 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
          >
            <video
              ref={swapped ? remoteVideoRef : localVideoRef}
              autoPlay
              playsInline
              muted={!swapped}
              className="w-full h-full object-cover"
              style={!swapped ? { transform: 'scaleX(-1)' } : undefined}
            />
          </div>
        )}

        {/* Top-left: peer name (only during active video call) */}
        {isVideo && isActive && info.remoteStream && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-black/40 rounded-lg px-3 py-1.5 backdrop-blur-sm">
            {info.peerAvatar && (
              <img src={info.peerAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
            )}
            <span className="text-white text-sm font-medium">{info.peerName}</span>
            <span className="text-white/50 text-xs ml-1">{formatDuration(elapsed)}</span>
          </div>
        )}

        {/* Center content (avatar, name, status — shown when NOT in active video) */}
        {!(isVideo && isActive && info.remoteStream) && (
          <div className="relative z-10 flex flex-col items-center gap-6">
            <motion.div
              animate={isIncoming ? { scale: [1, 1.05, 1] } : {}}
              transition={isIncoming ? { duration: 1.5, repeat: Infinity } : {}}
              className="relative"
            >
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
                {info.peerAvatar ? (
                  <img src={info.peerAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#D8103F]/50 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
                    {info.peerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {isIncoming && (
                <motion.div
                  animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-white/30"
                />
              )}
            </motion.div>

            <h2 className="text-white text-xl font-bold tracking-tight">
              {info.peerName}
            </h2>

            <p className="text-white/60 text-sm font-medium tracking-wide">
              {isIncoming && (isVideo ? 'Incoming video call...' : 'Incoming audio call...')}
              {isOutgoing && 'Calling...'}
              {isConnecting && 'Connecting...'}
              {isActive && formatDuration(elapsed)}
            </p>
          </div>
        )}

        {/* Controls — LEFT side for active/connecting, center for incoming/outgoing */}
        <div className={`relative z-30 ${
          (isActive || isConnecting)
            ? 'fixed left-4 bottom-1/2 translate-y-1/2 flex flex-col items-center gap-3'
            : 'mt-12 flex items-center gap-4'
        }`}>
          {/* Incoming: Accept + Decline */}
          {isIncoming && (
            <>
              <button
                onClick={declineCall}
                className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all hover:scale-105 active:scale-95"
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
              </button>
            </>
          )}

          {/* Outgoing: Cancel */}
          {isOutgoing && (
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-7 h-7 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
              </svg>
            </button>
          )}

          {/* Active/Connecting: Mute, Camera, Fullscreen, End — vertical on left side */}
          {(isActive || isConnecting) && (
            <>
              <button
                onClick={handleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                  isMuted
                    ? 'bg-white/20 text-red-400'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {isMuted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              {isVideo && (
                <button
                  onClick={handleCamera}
                  title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                    isCameraOff
                      ? 'bg-white/20 text-red-400'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isCameraOff ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              )}

              {isVideo && (
                <button
                  onClick={handleFullscreen}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 hover:bg-white/20"
                >
                  {isFullscreen ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>
              )}

              <button
                onClick={endCall}
                title="End call"
                className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
              >
                <svg className="w-6 h-6 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallOverlay;
