/*
  The short time a post card shows beside the author: "just now", "5m",
  "2h", "3d", then a date — "6 Sep" this year, "6 Sep 2025" before it.
  The browser's toLocaleDateString() gave "9/6/2026", which reads as a
  different day depending on where the reader is from.
*/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "6 Sep" in the current year, "6 Sep 2025" before it. */
export function shortDate(then: Date, now: number = Date.now()): string {
  const date = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return then.getFullYear() === new Date(now).getFullYear() ? date : `${date} ${then.getFullYear()}`;
}

export function postTimeLabel(iso: string, now: number = Date.now()): string {
  const then = new Date(iso);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return '';
  const sec = Math.floor((now - ms) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return shortDate(then, now);
}

/** The full date and time, for the label's hover title. */
export function postTimeTitle(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  return then.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}
