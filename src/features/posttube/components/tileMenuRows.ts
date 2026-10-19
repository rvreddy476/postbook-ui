/*
  The rows of a video tile's "⋮" menu, one alphabetical list like every
  other More menu in the app. Every row is a real request the watch page
  already makes:

    Copy link                      the watch URL to the clipboard
    Don't recommend this channel   POST /v1/feed/feedback {author_id}
    Not interested                 POST /v1/feed/feedback {post_id}
    Save to playlist               SaveToPlaylistDialog
    Share                          ShareDialog
    Watch later / Remove from …    POST|DELETE /v1/posts/:id/watch-later

  Signed out, only the two that need no account. Your own video has no
  "not interested" rows.
*/
export type TileMenuKey = "copy-link" | "dont-recommend" | "not-interested" | "playlist" | "share" | "watch-later";

export interface TileMenuRow {
  key: TileMenuKey;
  label: string;
}

export function tileMenuRows({ signedIn, own, queued }: { signedIn: boolean; own: boolean; queued: boolean }): TileMenuRow[] {
  const rows: TileMenuRow[] = [
    { key: "copy-link", label: "Copy link" },
    { key: "share", label: "Share" },
  ];
  if (signedIn) {
    rows.push({ key: "playlist", label: "Save to playlist" });
    rows.push({ key: "watch-later", label: queued ? "Remove from Watch later" : "Watch later" });
    if (!own) {
      rows.push({ key: "dont-recommend", label: "Don't recommend this channel" });
      rows.push({ key: "not-interested", label: "Not interested" });
    }
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}
