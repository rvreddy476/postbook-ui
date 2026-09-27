import Link from "next/link";
import { BarChart3, Captions, Clapperboard, Inbox, Video } from "lucide-react";
import type { ReactNode } from "react";

/*
  Empty and state cards. Pure presentation: no hooks, so the tests render
  them with renderToStaticMarkup.
*/
export function HubEmpty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="hub-empty" role="status">
      {icon}
      <div className="hub-empty-title">{title}</div>
      {body ? <div className="hub-empty-body">{body}</div> : null}
      {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}

export function LibraryEmpty({ kind }: { kind: "videos" | "flicks" | "live" | "collections" }) {
  if (kind === "flicks") {
    return (
      <HubEmpty
        icon={<Clapperboard aria-hidden="true" />}
        title="No shorts yet"
        body="Shorts you publish appear here with their visibility, views and conversations."
        action={
          <Link href="/reels/create" className="hub-btn hub-btn-primary">
            Make a short
          </Link>
        }
      />
    );
  }
  if (kind === "live") {
    return <HubEmpty icon={<Video aria-hidden="true" />} title="No live recordings" body="When a stream ends, its recording lands here as an unlisted video for you to publish." />;
  }
  if (kind === "collections") {
    return (
      <HubEmpty
        icon={<Video aria-hidden="true" />}
        title="No collections yet"
        body="Group videos into collections viewers can play in order."
        action={
          <Link href="/posttube/playlists" className="hub-btn">
            Open collections
          </Link>
        }
      />
    );
  }
  return (
    <HubEmpty
      icon={<Video aria-hidden="true" />}
      title="No videos yet"
      body="Upload your first video and it will show up here with its flags, visibility, views and conversations."
      action={
        <Link href="/posttube/upload" className="hub-btn hub-btn-primary">
          Upload a video
        </Link>
      }
    />
  );
}

export function OverviewEmpty() {
  return (
    <HubEmpty
      icon={<Video aria-hidden="true" />}
      title="Your channel is quiet"
      body="Nothing has been published yet. Upload a video to see counts, live views and insights here."
      action={
        <Link href="/posttube/upload" className="hub-btn hub-btn-primary">
          Upload a video
        </Link>
      }
    />
  );
}

export function InboxEmpty({ unanswered }: { unanswered: boolean }) {
  return (
    <HubEmpty
      icon={<Inbox aria-hidden="true" />}
      title={unanswered ? "Nothing waiting for a reply" : "No conversations yet"}
      body={unanswered ? "Every comment on your content has an answer from you." : "Comments on your videos, shorts and posts gather here."}
    />
  );
}

export function CaptionsEmpty({ status }: { status: "all" | "draft" | "published" }) {
  return (
    <HubEmpty
      icon={<Captions aria-hidden="true" />}
      title={status === "draft" ? "No caption drafts" : status === "published" ? "No published captions" : "No captions yet"}
      body="Upload a subtitle file or generate captions from the Library's edit sheet, then publish them here."
    />
  );
}

export function InsightsEmpty() {
  return <HubEmpty icon={<BarChart3 aria-hidden="true" />} title="No views in this period" body="Insights fill in once viewers start watching." />;
}

export function HubError({ message = "Could not load this. Try again in a moment." }: { message?: string }) {
  return (
    <div className="hub-error" role="alert">
      {message}
    </div>
  );
}

export function HubSkeleton({ rows = 5, height = 34 }: { rows?: number; height?: number }) {
  return (
    <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="hub-skel" style={{ height }} />
      ))}
    </div>
  );
}
