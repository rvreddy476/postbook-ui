"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, Send } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { useScheduledPosts, useUpdateSchedule } from "@/hooks/usePosttubeExtras";
import { useToast } from "@/components/ui/toast";
import type { ScheduledPost } from "@/features/posttube/data/posttubeApi";
import { rowToVideo } from "@/features/posttube/model";

/*
  GET /v1/posts/me/scheduled?limit=50; PATCH /v1/posts/:id/schedule { publish_at? }
  (no body = publish now).
*/

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Toast = ReturnType<typeof useToast>["toast"];

function ScheduledRow({ post, toast }: { post: ScheduledPost; toast: Toast }) {
  const update = useUpdateSchedule();
  const publishAt = post.publish_at ?? post.scheduled_at ?? null;
  const [when, setWhen] = useState(toLocalInputValue(publishAt));
  const [editing, setEditing] = useState(false);
  const video = rowToVideo(post);
  const isVideo = (post.content_type ?? "").includes("video") || (post.content_type ?? "") === "flick" || (post.content_type ?? "") === "reel";

  const publishNow = () =>
    update.mutate(
      { postId: post.id },
      {
        onSuccess: () => toast({ type: "success", title: "Published", description: "It is live now." }),
        onError: () => toast({ type: "error", title: "Could not publish" }),
      },
    );

  const reschedule = () => {
    if (!when) return;
    const iso = new Date(when).toISOString();
    update.mutate(
      { postId: post.id, publishAt: iso },
      {
        onSuccess: () => {
          setEditing(false);
          toast({ type: "success", title: "Rescheduled", description: new Date(iso).toLocaleString() });
        },
        onError: () => toast({ type: "error", title: "Could not reschedule" }),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-brand-card p-3">
      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-brand-secondary">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">No poster</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={isVideo ? `/posttube/watch/${post.id}` : `/post/${post.id}`} className="line-clamp-2 text-[14px] font-semibold leading-tight text-brand-text hover:text-primary-ink">
          {video.title}
        </Link>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {publishAt ? `Goes live ${new Date(publishAt).toLocaleString()}` : "No time set"}
          {post.content_type ? ` · ${post.content_type.replace("_", " ")}` : ""}
        </p>
        {editing ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={when}
              min={toLocalInputValue(new Date().toISOString())}
              onChange={(e) => setWhen(e.target.value)}
              className="rounded-lg border border-border bg-brand-bg px-2 py-1.5 text-[12px] text-brand-text"
            />
            <button
              type="button"
              onClick={reschedule}
              disabled={update.isPending || !when}
              className="rounded-full bg-primary-ink px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {update.isPending ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-brand-text hover:bg-brand-secondary">
              Cancel
            </button>
          </div>
        ) : null}
      </div>
      {!editing ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-[12px] font-semibold text-brand-text hover:bg-brand-secondary"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Reschedule
          </button>
          <button
            type="button"
            onClick={publishNow}
            disabled={update.isPending}
            className="flex items-center gap-1.5 rounded-full bg-primary-ink px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publish now
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function PosttubeScheduledPage() {
  const user = useAuthUser();
  const scheduled = useScheduledPosts(50);
  const { toast, ToastContainer } = useToast();
  const rows = scheduled.data ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-secondary text-brand-text">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">Scheduled</h1>
          <p className="text-[12px] text-muted-foreground">Posts and videos waiting for their publish time.</p>
        </div>
      </div>

      {!user ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">Sign in to see your scheduled posts.</div>
      ) : scheduled.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : scheduled.isError ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">Could not load your scheduled posts.</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">
          Nothing scheduled.{" "}
          <Link href="/posttube/upload?type=long" className="font-semibold text-primary-ink hover:underline">
            Upload a video
          </Link>{" "}
          and pick a publish time.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <ScheduledRow key={p.id} post={p} toast={toast} />
          ))}
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
