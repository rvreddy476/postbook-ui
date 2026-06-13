// Dedicated SSE subscription to /v1/notifications/stream.
//
// Replaces the multiplexed WebSocket as the source of live
// notifications per README §1 (SSE for one-way platform updates,
// WS only for chat). Two reasons we want this on the web:
//
//   1. Native browser EventSource handles Last-Event-ID automatically:
//      on reconnect it sends the last `id:` it saw, and the
//      notification-service handler replays missed events from Scylla
//      before going live. Surviving a closed laptop lid / wifi drop
//      gets you the toasts you would have seen — not just a stale
//      bell counter waiting for refetch.
//
//   2. Decoupling from chat-ws-gateway means notification fan-out
//      doesn't compete with chat protocol traffic for that gateway's
//      goroutine budget.
//
// Auth: the api-gateway accepts the `access_token` cookie set by
// login. EventSource sends cookies on same-origin requests by
// default; setting withCredentials guarantees that on cross-origin
// builds too.

"use client";

import { useEffect, useRef } from "react";

export interface IncomingPayload {
    notification_id?: string;
    title?: string;
    body?: string;
    deep_link?: string;
    collapse_key?: string;
    bucket?: number;
    ts?: string;
    created_at?: string;
    event_type?: string;
    actor_id?: string;
    actor_name?: string;
    target_id?: string;
    target_type?: string;
}

type Listener = (data: IncomingPayload, eventId: string | null) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let refCount = 0;

function openSource() {
    if (source) return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const url = `${base}/v1/notifications/stream`;
    source = new EventSource(url, { withCredentials: true });
    source.addEventListener("notification", (e: MessageEvent) => {
        try {
            const envelope = JSON.parse(e.data) as {
                type?: string;
                payload?: IncomingPayload;
            };
            const payload = envelope?.payload ?? (envelope as IncomingPayload);
            const eventId = (e as MessageEvent & { lastEventId?: string }).lastEventId ?? null;
            listeners.forEach((cb) => cb(payload, eventId));
        } catch {
            // Bad payload — wait for the next push to correct us.
        }
    });
    // EventSource auto-reconnects with the spec-default delay
    // (~3 s). Errors are non-fatal; we leave the connection in
    // the browser's hands.
}

function closeSource() {
    if (!source) return;
    source.close();
    source = null;
}

/**
 * Subscribe a listener for the lifetime of the calling component.
 * The underlying EventSource is shared across all subscribers —
 * opens on first mount, closes when the last subscriber unmounts.
 */
export function useNotificationStream(listener: Listener) {
    const ref = useRef(listener);
    ref.current = listener;

    useEffect(() => {
        const fn: Listener = (data, id) => ref.current(data, id);
        listeners.add(fn);
        refCount += 1;
        openSource();
        return () => {
            listeners.delete(fn);
            refCount -= 1;
            if (refCount <= 0) {
                refCount = 0;
                closeSource();
            }
        };
    }, []);
}
