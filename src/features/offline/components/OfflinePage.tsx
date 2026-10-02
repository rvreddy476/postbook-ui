"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, Play, RotateCw, Trash2, WifiOff, X } from "lucide-react";

import { ReelConfirmDialog } from "@/features/reels/components/ReelConfirmDialog";
import "@/features/reels/components/reels-screen.css";
import "@/features/posttube/library/components/library.css";

import { storageEstimate } from "../client";
import { copyProgress } from "../copyState";
import { useOfflineManager, useOfflineSnapshot, useStorageKind } from "../hooks";
import type { CopyView, OfflineManager } from "../manager";
import { percent } from "../row";
import { expiryLabel, formatBytes, removalNotice } from "../schedule";
import { registerOfflineShellInBrowser } from "../serviceWorker";
import { OfflinePlayer } from "./OfflinePlayer";
import { OfflineProgressRing } from "./OfflineProgressRing";
import "./offline.css";

/*
  /posttube/offline — the videos and reels saved in the app on this device.
  Each row: the poster, the title, the channel, the size and when the copy
  expires; press it to play the stored copy right here (no network needed),
  or remove it. A save in progress shows its ring and can be stopped; one
  that was interrupted can be continued. The header says how much space
  the copies take and removes them all.

  Nothing on this page is a link to a file.
*/

export function durationLabel(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** The meta line of a stored row: channel · size · expiry. Empty parts are left out. */
export function rowMeta(view: CopyView, now: number): string {
  const r = view.record;
  if (!r) return "";
  return [r.channelName, formatBytes(r.bytes), expiryLabel(r.expiresAt, now)].filter(Boolean).join(" · ");
}

function useStoredPoster(manager: OfflineManager | null, view: CopyView): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const stored = view.record?.posterStored === true;
  useEffect(() => {
    if (!manager || !stored) return;
    let alive = true;
    let release: (() => void) | null = null;
    void manager.openPoster(view.postId).then((p) => {
      if (!p) return;
      if (!alive) {
        p.release();
        return;
      }
      release = p.release;
      setUrl(p.url);
    });
    return () => {
      alive = false;
      release?.();
      setUrl(null);
    };
  }, [manager, view.postId, stored]);
  return url;
}

interface RowProps {
  manager: OfflineManager;
  view: CopyView;
  now: number;
  onPlay: (view: CopyView) => void;
}

function OfflineRowItem({ manager, view, now, onPlay }: RowProps) {
  const record = view.record!;
  const poster = useStoredPoster(manager, view);
  const { state } = view;
  const stored = state.phase === "stored";
  const saving = state.phase === "downloading";
  const progress = copyProgress(state);
  const length = durationLabel(record.durationMs);

  const thumb = (
    <>
      {poster ? <img src={poster} alt="" /> : <span className="tube-library__thumb-empty">{saving ? "Saving" : "No preview"}</span>}
      {length ? <span className="tube-library__duration">{length}</span> : null}
    </>
  );

  return (
    <li className="tube-library__row offline-row" data-offline-row={view.postId} data-state={state.phase}>
      {stored ? (
        <button type="button" className={`tube-library__thumb offline-row__thumb${record.surface === "reel" ? " is-reel" : ""}`} onClick={() => onPlay(view)} aria-label={`Play ${record.title}`}>
          {thumb}
        </button>
      ) : (
        <span className={`tube-library__thumb${record.surface === "reel" ? " is-reel" : ""}`}>{thumb}</span>
      )}
      <div className="tube-library__body">
        {stored ? (
          <button type="button" className="offline-row__open" onClick={() => onPlay(view)}>
            <span className="tube-library__row-title">{record.title}</span>
          </button>
        ) : (
          <span className="tube-library__row-title">{record.title}</span>
        )}
        {stored ? (
          <p className="tube-library__row-meta">{rowMeta(view, now)}</p>
        ) : saving ? (
          <p className="offline-row__state">
            <OfflineProgressRing progress={progress} size={16} label={`Saving ${record.title}`} />
            Saving{progress === null ? "" : ` ${percent(progress)}`}
          </p>
        ) : (
          <p className={`offline-row__state${state.message ? " is-problem" : ""}`}>
            {state.resumable && state.totalBytes ? `Paused at ${percent(state.receivedBytes / state.totalBytes)}` : state.message || "Not finished"}
          </p>
        )}
      </div>
      <div className="tube-library__row-actions">
        {stored ? (
          <button type="button" className="tube-library__icon-button" onClick={() => onPlay(view)} aria-label={`Play ${record.title}`} title="Play">
            <Play />
          </button>
        ) : saving ? (
          <button type="button" className="tube-library__icon-button" onClick={() => manager.cancel(view.postId)} aria-label={`Stop saving ${record.title}`} title="Stop">
            <X />
          </button>
        ) : (
          <button type="button" className="tube-library__icon-button" onClick={() => void manager.save(view.postId, record.surface)} aria-label={`Continue saving ${record.title}`} title="Continue">
            <RotateCw />
          </button>
        )}
        {saving ? null : (
          <button type="button" className="tube-library__icon-button is-danger" onClick={() => void manager.remove(view.postId)} aria-label={`Remove ${record.title}`} title="Remove">
            <Trash2 />
          </button>
        )}
      </div>
    </li>
  );
}

function Section({ title, views, manager, now, onPlay }: { title: string; views: CopyView[]; manager: OfflineManager; now: number; onPlay: (v: CopyView) => void }) {
  if (views.length === 0) return null;
  return (
    <section aria-label={title} data-offline-section={title.toLowerCase()}>
      <h2 className="offline-page__section">
        {title}
        <small>{views.length}</small>
      </h2>
      <ul className="tube-library__list" style={{ marginTop: 8 }}>
        {views.map((v) => (
          <OfflineRowItem key={v.postId} manager={manager} view={v} now={now} onPlay={onPlay} />
        ))}
      </ul>
    </section>
  );
}

export function OfflinePage() {
  const kind = useStorageKind();
  const manager = useOfflineManager();
  const snapshot = useOfflineSnapshot(manager);
  const [playing, setPlaying] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const read = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  // The page's own sweep, so what it lists is what may still be played.
  useEffect(() => {
    if (!manager) return;
    let alive = true;
    void manager
      .sync({ force: true, reconcile: true })
      .then((removed) => {
        if (alive) setNotice(removalNotice(removed));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [manager, online]);

  useEffect(() => {
    setNow(Date.now());
    void storageEstimate().then(setEstimate);
  }, [snapshot.usedBytes, snapshot.copies.length]);

  // With a copy on the device, let this page open with no network (a worker scoped to this page only).
  const hasCopies = snapshot.copies.length > 0;
  useEffect(() => {
    if (hasCopies) registerOfflineShellInBrowser();
  }, [hasCopies]);

  const playingView = playing ? snapshot.byId[playing] : undefined;
  useEffect(() => {
    if (playing && (!playingView || playingView.state.phase !== "stored")) setPlaying(null);
  }, [playing, playingView]);

  const videos = snapshot.copies.filter((v) => v.record?.surface !== "reel");
  const reels = snapshot.copies.filter((v) => v.record?.surface === "reel");
  const count = snapshot.copies.length;

  const removeAll = async () => {
    if (!manager) return;
    setRemovingAll(true);
    setPlaying(null);
    await manager.removeAll().catch(() => undefined);
    setRemovingAll(false);
    setConfirmAll(false);
  };

  let body: React.ReactNode;
  if (kind === "unknown" || (manager && !snapshot.ready)) {
    body = (
      <ul className="tube-library__list" aria-hidden>
        <li className="tube-library__skeleton" />
        <li className="tube-library__skeleton" />
      </ul>
    );
  } else if (kind === "none" || !manager) {
    body = (
      <div className="tube-library__empty" data-offline-unsupported>
        <WifiOff size={28} aria-hidden />
        <h2>Offline copies are not available here</h2>
        <p>This browser window cannot keep videos in the app (a private window, or site data is blocked). Open the app in a normal window to save videos offline.</p>
      </div>
    );
  } else if (count === 0) {
    body = (
      <div className="tube-library__empty" data-offline-empty>
        <ArrowDownToLine size={28} aria-hidden />
        <h2>Nothing saved offline yet</h2>
        <p>Open a video or a reel, press More, then Save offline. It stays here in the app and plays without a connection.</p>
        <Link href="/posttube" className="tube-library__cta">
          Browse videos
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        {playingView?.record ? <OfflinePlayer key={playingView.postId} postId={playingView.postId} title={playingView.record.title} surface={playingView.record.surface} onClose={() => setPlaying(null)} /> : null}
        <Section title="Videos" views={videos} manager={manager} now={now} onPlay={(v) => setPlaying(v.postId)} />
        <Section title="Reels" views={reels} manager={manager} now={now} onPlay={(v) => setPlaying(v.postId)} />
      </>
    );
  }

  const free = estimate ? Math.max(0, estimate.quota - estimate.usage) : null;
  const usedShare = estimate && estimate.quota > 0 ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;

  return (
    <div className="tube-library offline-page">
      <header className="tube-library__head">
        <span className="tube-library__glyph" aria-hidden>
          <ArrowDownToLine />
        </span>
        <div className="tube-library__titles">
          <h1 className="tube-library__title">Offline</h1>
          <p className="tube-library__meta">
            <span>{count === 1 ? "1 copy" : `${count} copies`}</span>
            {online ? null : (
              <span className="tube-library__pill">
                <WifiOff aria-hidden /> No connection
              </span>
            )}
          </p>
        </div>
        {count > 0 ? (
          <div className="tube-library__actions">
            <button type="button" className="tube-library__button is-quiet" onClick={() => setConfirmAll(true)} disabled={removingAll}>
              <Trash2 aria-hidden /> Remove all
            </button>
          </div>
        ) : null}
      </header>

      <p className="offline-page__note">
        Offline copies play only here in the app, on this device. Copies renew themselves while this device keeps coming online. A copy is removed when it expires, when its video is deleted, made private, or its creator turns offline copies off, and 48 hours after you sign out.
      </p>

      {count > 0 ? (
        <div className="offline-page__usage" data-offline-usage>
          <p className="offline-page__usage-line">
            <span>{formatBytes(snapshot.usedBytes)} used by offline copies</span>
            {free !== null ? <span>{formatBytes(free)} free for this app</span> : null}
          </p>
          {estimate ? (
            <div className="offline-page__usage-bar" aria-hidden>
              <span style={{ width: `${usedShare}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <p className="offline-page__note" role="status" data-offline-notice>
          {notice}
        </p>
      ) : null}

      {body}

      <ReelConfirmDialog
        open={confirmAll}
        title="Remove all offline copies?"
        description="Every video and reel saved on this device is removed. You can save them again while they are still available."
        confirmLabel="Remove all"
        danger
        pending={removingAll}
        onConfirm={() => void removeAll()}
        onCancel={() => setConfirmAll(false)}
      />
    </div>
  );
}
