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
} from '../services/callService';

function useCallRingtone(state: string | undefined) {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state !== 'incoming' && state !== 'outgoing') {
      // Stop any playing tone
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
      // Ring pattern: 440Hz beep for 300ms, silence 200ms, repeat
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
      // Ringback: lower tone 400Hz, 1s on / 3s off
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
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
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

const CallOverlay: React.FC = () => {
  const [info, setInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useCallRingtone(info?.state);

  useEffect(() => {
    return subscribeToCallState(setInfo);
  }, []);

  // Elapsed timer for active calls
  useEffect(() => {
    if (info?.state !== 'active' || !info.startedAt) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed(Date.now() - info.startedAt!), 1000);
    return () => clearInterval(id);
  }, [info?.state, info?.startedAt]);

  // Attach local video stream
  useEffect(() => {
    if (localVideoRef.current && info?.localStream) {
      localVideoRef.current.srcObject = info.localStream;
    }
  }, [info?.localStream]);

  // Attach remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && info?.remoteStream) {
      remoteVideoRef.current.srcObject = info.remoteStream;
    }
  }, [info?.remoteStream]);

  const handleMute = useCallback(() => {
    setIsMuted(toggleMute());
  }, []);

  const handleCamera = useCallback(() => {
    setIsCameraOff(toggleCamera());
  }, []);

  if (!info) return null;

  const isVideo = info.type === 'video';
  const isActive = info.state === 'active';
  const isIncoming = info.state === 'incoming';
  const isOutgoing = info.state === 'outgoing';
  const isConnecting = info.state === 'connecting';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-2xl"
      >
        {/* Remote video (full background for video calls) */}
        {isVideo && isActive && info.remoteStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Local video PiP (video calls, active) */}
        {isVideo && info.localStream && (isActive || isConnecting) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 right-6 z-10 w-36 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          </motion.div>
        )}

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Avatar (shown when not in active video call) */}
          {!(isVideo && isActive && info.remoteStream) && (
            <motion.div
              animate={isIncoming ? { scale: [1, 1.05, 1] } : {}}
              transition={isIncoming ? { duration: 1.5, repeat: Infinity } : {}}
              className="relative"
            >
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
                {info.peerAvatar ? (
                  <img src={info.peerAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
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
          )}

          {/* Name */}
          <h2 className="text-white text-xl font-bold tracking-tight">
            {info.peerName}
          </h2>

          {/* Status text */}
          <p className="text-white/60 text-sm font-medium tracking-wide">
            {isIncoming && (isVideo ? 'Incoming video call...' : 'Incoming audio call...')}
            {isOutgoing && 'Calling...'}
            {isConnecting && 'Connecting...'}
            {isActive && formatDuration(elapsed)}
          </p>
        </div>

        {/* Controls */}
        <div className="relative z-10 mt-12 flex items-center gap-4">
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

          {/* Active/Connecting: Mute, Camera toggle, End */}
          {(isActive || isConnecting) && (
            <>
              <button
                onClick={handleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                  isMuted
                    ? 'bg-white/20 text-red-400'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {isMuted ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              {isVideo && (
                <button
                  onClick={handleCamera}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                    isCameraOff
                      ? 'bg-white/20 text-red-400'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isCameraOff ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              )}

              <button
                onClick={endCall}
                className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
              >
                <svg className="w-7 h-7 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
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
