export const FEED_RETURN_DELAY = 60_000;

/** Event-driven: no polling and no whole-page reload or loss of composer state. */
export function installFeedReturnRefresh(
  win: Pick<Window, 'addEventListener' | 'removeEventListener' | 'navigator'>,
  doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState' | 'hasFocus'>,
  refresh: () => Promise<unknown>,
  now: () => number = Date.now,
) {
  let awayAt: number | null = doc.visibilityState === 'hidden' || !doc.hasFocus() ? now() : null;
  let pending = false;
  let running = false;
  let disposed = false;
  const leave = () => { awayAt ??= now(); };
  const resume = () => {
    if (disposed || doc.visibilityState !== 'visible' || !doc.hasFocus()) return;
    if (awayAt !== null) {
      pending ||= now() - awayAt >= FEED_RETURN_DELAY;
      awayAt = null;
    }
    if (!pending || running || !win.navigator.onLine) return;
    pending = false;
    running = true;
    // Query errors remain visible through the existing feed error UI.
    void Promise.resolve().then(refresh).catch(() => {}).finally(() => {
      running = false;
      if (pending && !disposed) resume();
    });
  };
  const visibility = () => doc.visibilityState === 'hidden' ? leave() : resume();
  win.addEventListener('blur', leave);
  win.addEventListener('focus', resume);
  win.addEventListener('online', resume);
  doc.addEventListener('visibilitychange', visibility);
  return () => {
    disposed = true;
    win.removeEventListener('blur', leave);
    win.removeEventListener('focus', resume);
    win.removeEventListener('online', resume);
    doc.removeEventListener('visibilitychange', visibility);
  };
}
