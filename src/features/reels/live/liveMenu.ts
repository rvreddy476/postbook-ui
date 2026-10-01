/*
  The More menu of the live stage, as data. Rows are alphabetical (house
  rule). Report is offered to viewers and moderators, never to the host or
  a signed-out reader (features/live/chat.ts streamTools decides and the
  screen passes the answer in); Watch on PostTube only for a landscape
  stream.
*/

export type LiveMoreKey = "copy-link" | "report" | "watch-on-posttube";

export interface LiveMoreItem {
  key: LiveMoreKey;
  label: string;
}

export function liveMoreItems(ctx: { canReport: boolean; landscape: boolean }): LiveMoreItem[] {
  const items: LiveMoreItem[] = [{ key: "copy-link", label: "Copy link" }];
  if (ctx.canReport) items.push({ key: "report", label: "Report" });
  if (ctx.landscape) items.push({ key: "watch-on-posttube", label: "Watch on PostTube" });
  return items.sort((a, b) => a.label.localeCompare(b.label));
}
