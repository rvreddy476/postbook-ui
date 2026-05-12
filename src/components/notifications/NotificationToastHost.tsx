// Notification toast host — sits at the app root and renders bursts of
// realtime notifications as collapsed, debounced toasts.
//
// Why this exists: the existing useNotificationBell hook updates the
// unread counter + plays a sound but renders no toast at all, so users
// don't see real-time content. The README §8 spec asks for client-side
// queue + collapse-by-key behavior; this mirrors what the mobile shell
// does in features/shell/notification_toast_queue.dart, just in
// browser-flavored React.
//
// Behavior summary:
//   - 1 event in the burst window → show its title.
//   - 2+ events sharing collapse_key → "<latest title> +N more".
//   - 3+ distinct collapse_keys → "N new notifications" summary
//     pointing at /notifications.
//   - At most one toast on-screen at a time. The queue handles the
//     merging — visible stack stays clean.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import Link from "next/link";

import { useNotificationStream } from "@/hooks/useNotificationStream";

interface IncomingNotification {
    notification_id?: string;
    title?: string;
    body?: string;
    deep_link?: string;
    collapse_key?: string;
    bucket?: number;
    ts?: string;
    created_at?: string;
    event_type?: string;
}

interface ToastView {
    key: string;
    title: string;
    body: string;
    deepLink: string | null;
    eventCount: number;
    isSummary: boolean;
}

const DEBOUNCE_MS = 200;
const WINDOW_MS = 8_000;
const SUMMARY_THRESHOLD = 3;
const VISIBLE_MS = 5_000;

function bestKey(n: IncomingNotification): string {
    if (n.collapse_key && n.collapse_key.length > 0) return n.collapse_key;
    return `standalone:${n.notification_id ?? n.ts ?? crypto.randomUUID()}`;
}

function isSafeInAppPath(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
    const pathOnly = trimmed.split("?")[0].split("#")[0];
    if (!/^[A-Za-z0-9_\-/:%.]+$/.test(pathOnly)) return null;
    return trimmed;
}

export default function NotificationToastHost() {
    const bufferRef = useRef<IncomingNotification[]>([]);
    const timerRef = useRef<number | null>(null);
    const visibleTimerRef = useRef<number | null>(null);
    const [view, setView] = useState<ToastView | null>(null);

    const buildView = useCallback((events: IncomingNotification[]): ToastView => {
        const groups = new Map<string, IncomingNotification[]>();
        for (const e of events) {
            const k = bestKey(e);
            const arr = groups.get(k) ?? [];
            arr.push(e);
            groups.set(k, arr);
        }
        const latest = events[events.length - 1];
        const latestDeep = isSafeInAppPath(latest.deep_link);

        if (groups.size === 1) {
            const items = Array.from(groups.values())[0];
            if (items.length === 1) {
                return {
                    key: latest.notification_id ?? `${Date.now()}`,
                    title: latest.title?.trim() ? latest.title : "New notification",
                    body: latest.body ?? "",
                    deepLink: latestDeep,
                    eventCount: 1,
                    isSummary: false,
                };
            }
            return {
                key: bestKey(latest),
                title: latest.title?.trim() ? latest.title : "New activity",
                body: `+${items.length - 1} more`,
                deepLink: latestDeep,
                eventCount: items.length,
                isSummary: false,
            };
        }

        if (groups.size >= SUMMARY_THRESHOLD) {
            return {
                key: `summary-${Date.now()}`,
                title: `${events.length} new notifications`,
                body: "Tap to view",
                deepLink: "/notifications",
                eventCount: events.length,
                isSummary: true,
            };
        }

        return {
            key: latest.notification_id ?? `${Date.now()}`,
            title: latest.title?.trim() ? latest.title : "New notification",
            body: `+${events.length - 1} more`,
            deepLink: latestDeep,
            eventCount: events.length,
            isSummary: false,
        };
    }, []);

    const flush = useCallback(() => {
        if (bufferRef.current.length === 0) return;
        const next = buildView(bufferRef.current);
        bufferRef.current = [];
        setView(next);
        if (visibleTimerRef.current) {
            window.clearTimeout(visibleTimerRef.current);
        }
        visibleTimerRef.current = window.setTimeout(() => {
            setView(null);
            visibleTimerRef.current = null;
        }, VISIBLE_MS);
    }, [buildView]);

    useNotificationStream((data) => {
        // Prune anything older than the window before appending —
        // defensive; the buffer empties on every flush anyway.
        const cutoff = Date.now() - WINDOW_MS;
        bufferRef.current = bufferRef.current.filter((e) => {
            const t = e.created_at ? Date.parse(e.created_at) : Date.now();
            return t >= cutoff;
        });
        bufferRef.current.push(data);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(flush, DEBOUNCE_MS);
    });

    useEffect(() => {
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
            if (visibleTimerRef.current) window.clearTimeout(visibleTimerRef.current);
        };
    }, []);

    if (!view) return null;

    const body = (
        <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-violet-200 bg-brand-card px-4 py-3 shadow-xl shadow-violet-500/10">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100">
                <Bell className="h-4 w-4 text-violet-600" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-brand-text">
                    {view.title}
                </p>
                {view.body && (
                    <p className="mt-0.5 truncate text-[12px] text-brand-text/60">
                        {view.body}
                    </p>
                )}
            </div>
            <button
                type="button"
                onClick={() => setView(null)}
                aria-label="Dismiss"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-brand-text/40 transition-colors hover:bg-brand-bg hover:text-brand-text"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );

    return (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[80] flex flex-col gap-2">
            {view.deepLink ? (
                <Link
                    key={view.key}
                    href={view.deepLink}
                    className="pointer-events-auto"
                    onClick={() => setView(null)}
                >
                    {body}
                </Link>
            ) : (
                body
            )}
        </div>
    );
}
