import { User } from '@/types';
import { sendSignaling, subscribeToCallSignals, CallSignal } from './messageService';
import { getSession } from './authService';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';
export type CallType = 'audio' | 'video';

export interface CallInfo {
  state: CallState;
  type: CallType;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  startedAt?: number;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let callInfo: CallInfo | null = null;
let pc: RTCPeerConnection | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];
const stateListeners = new Set<(info: CallInfo | null) => void>();

function notify() {
  const snapshot = callInfo ? { ...callInfo } : null;
  stateListeners.forEach(cb => cb(snapshot));
}

function updateState(patch: Partial<CallInfo>) {
  if (!callInfo) return;
  Object.assign(callInfo, patch);
  notify();
}

function cleanup() {
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.oniceconnectionstatechange = null;
    pc.close();
    pc = null;
  }
  if (callInfo?.localStream) {
    callInfo.localStream.getTracks().forEach(t => t.stop());
  }
  pendingCandidates = [];
  callInfo = null;
  notify();
}

function createPeerConnection(): RTCPeerConnection {
  const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  conn.onicecandidate = (e) => {
    if (e.candidate && callInfo) {
      sendSignaling({
        type: 'ice_candidate',
        target_user_id: callInfo.peerId,
        candidate: e.candidate.toJSON(),
      });
    }
  };

  conn.ontrack = (e) => {
    if (callInfo && e.streams[0]) {
      updateState({ remoteStream: e.streams[0] });
    }
  };

  conn.oniceconnectionstatechange = () => {
    if (!conn) return;
    const s = conn.iceConnectionState;
    if (s === 'connected' || s === 'completed') {
      updateState({ state: 'active', startedAt: Date.now() });
    } else if (s === 'failed' || s === 'disconnected' || s === 'closed') {
      endCall();
    }
  };

  return conn;
}

async function getMedia(type: CallType): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video',
  });
}

async function flushPendingCandidates() {
  if (!pc) return;
  for (const c of pendingCandidates) {
    await pc.addIceCandidate(new RTCIceCandidate(c));
  }
  pendingCandidates = [];
}

// --- Public API ---

export function initiateCall(contact: User, type: CallType) {
  if (callInfo) return; // already in a call

  callInfo = {
    state: 'outgoing',
    type,
    peerId: contact.id,
    peerName: contact.name,
    peerAvatar: contact.avatar,
  };
  notify();

  (async () => {
    try {
      const stream = await getMedia(type);
      if (!callInfo || callInfo.state !== 'outgoing') {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      updateState({ localStream: stream });

      pc = createPeerConnection();
      stream.getTracks().forEach(t => pc!.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignaling({
        type: 'call_offer',
        target_user_id: contact.id,
        call_type: type,
        sdp: offer.sdp,
      });
    } catch (err) {
      console.error('Failed to initiate call:', err);
      cleanup();
    }
  })();
}

export function acceptCall() {
  if (!callInfo || callInfo.state !== 'incoming') return;

  updateState({ state: 'connecting' });

  (async () => {
    try {
      const stream = await getMedia(callInfo!.type);
      if (!callInfo) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      updateState({ localStream: stream });

      pc = createPeerConnection();
      stream.getTracks().forEach(t => pc!.addTrack(t, stream));

      // The offer SDP was stored in pendingOffer
      const offerSdp = (callInfo as any)._offerSdp as string;
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
      await flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignaling({
        type: 'call_answer',
        target_user_id: callInfo!.peerId,
        sdp: answer.sdp,
      });
    } catch (err) {
      console.error('Failed to accept call:', err);
      cleanup();
    }
  })();
}

export function declineCall() {
  if (!callInfo) return;
  sendSignaling({ type: 'call_decline', target_user_id: callInfo.peerId });
  cleanup();
}

export function endCall() {
  if (!callInfo) return;
  sendSignaling({ type: 'call_end', target_user_id: callInfo.peerId });
  cleanup();
}

export function toggleMute(): boolean {
  if (!callInfo?.localStream) return false;
  const track = callInfo.localStream.getAudioTracks()[0];
  if (!track) return false;
  track.enabled = !track.enabled;
  return !track.enabled; // true = muted
}

export function toggleCamera(): boolean {
  if (!callInfo?.localStream) return false;
  const track = callInfo.localStream.getVideoTracks()[0];
  if (!track) return false;
  track.enabled = !track.enabled;
  return !track.enabled; // true = camera off
}

export function subscribeToCallState(cb: (info: CallInfo | null) => void): () => void {
  stateListeners.add(cb);
  cb(callInfo ? { ...callInfo } : null);
  return () => { stateListeners.delete(cb); };
}

// --- Incoming signal handler ---

function handleSignal(signal: CallSignal) {
  const currentUser = getSession();
  if (!currentUser) return;

  switch (signal.type) {
    case 'call_offer': {
      if (callInfo) {
        // Already in a call — send busy
        sendSignaling({ type: 'call_busy', target_user_id: signal.sender_id });
        return;
      }
      callInfo = {
        state: 'incoming',
        type: signal.call_type || 'audio',
        peerId: signal.sender_id,
        peerName: signal.sender_id, // Will be resolved by UI
        peerAvatar: '',
      };
      (callInfo as any)._offerSdp = signal.sdp;
      notify();
      break;
    }

    case 'call_answer': {
      if (!callInfo || callInfo.state !== 'outgoing' || !pc) return;
      updateState({ state: 'connecting' });
      (async () => {
        try {
          await pc!.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          await flushPendingCandidates();
        } catch (err) {
          console.error('Failed to handle call answer:', err);
          cleanup();
        }
      })();
      break;
    }

    case 'ice_candidate': {
      if (!signal.candidate) return;
      if (pc && pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else {
        pendingCandidates.push(signal.candidate);
      }
      break;
    }

    case 'call_end':
    case 'call_decline': {
      cleanup();
      break;
    }

    case 'call_busy': {
      cleanup();
      break;
    }
  }
}

// Auto-subscribe to signaling events
subscribeToCallSignals(handleSignal);
