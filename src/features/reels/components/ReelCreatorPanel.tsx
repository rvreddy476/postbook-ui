"use client";

import Link from "next/link";
import { BadgeCheck, Link2, MessageCircle, UserCheck, Users, ArrowUpRight } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { formatCount, type ReelItem } from "@/features/reels/model";
import { useGraphCounts, useProfile } from "@/hooks/useProfile";
import { useProfilePosts } from "@/hooks/useProfilePosts";
import { useMutualConnectionCounts } from "@/hooks/useConnections";
import type { Relationship } from "@/types/profile";
import type { PostDetail } from "@/types/profile";

interface ReelCreatorPanelProps {
  reel: ReelItem;
  viewerId: string;
  isOwn: boolean;
  relationship: Relationship | undefined;
  followPending: boolean;
  onToggleFollow: () => void;
  onOpenReel: (id: string) => void;
}

/*
  The creator column beside the stage. What the overlay squeezes into one
  line on the video gets room here: who this is, how the viewer stands with
  them (follows you, connected, mutual connections), their reach, and more
  of their reels. Everything reads from routes the profile page already
  uses; nothing is invented client-side.
*/
export function ReelCreatorPanel({ reel, viewerId, isOwn, relationship, followPending, onToggleFollow, onOpenReel }: ReelCreatorPanelProps) {
  const profile = useProfile(reel.authorUsername);
  const counts = useGraphCounts(reel.authorId);
  const mutuals = useMutualConnectionCounts(isOwn ? undefined : viewerId || undefined, [reel.authorId]);
  const more = useProfilePosts(reel.authorId, "flick");

  const profileHref = reel.authorUsername ? `/u/${reel.authorUsername}` : `/u/${reel.authorId}`;
  const p = profile.data;
  const followers = counts.data?.follower_count ?? p?.follower_count;
  const followingCount = counts.data?.following_count ?? p?.following_count;
  const friends = counts.data?.friend_count ?? p?.friend_count;
  const mutualCount = mutuals.data?.get(reel.authorId);
  const following = relationship?.following;

  const moreReels: PostDetail[] = (more.data?.pages.flatMap((pg) => pg.data ?? []) ?? [])
    .filter((post) => post.id !== reel.id)
    .slice(0, 6);

  return (
    <aside
      data-creator-panel="true"
      className="reel-creator-card"
      onClick={(e) => e.stopPropagation()}
    >
      {/* identity */}
      <div className="reel-creator-identity">
        <Link href={profileHref} className="shrink-0">
          <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="xl" className="ring-2 ring-brand-accent/40" />
        </Link>
        <Link href={profileHref} className="mt-3 flex max-w-full items-center gap-1 text-[15px] font-bold hover:underline">
          <span className="truncate">{p?.display_name || reel.authorName}</span>
          {p?.is_verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-brand-accent" aria-label="Verified" /> : null}
        </Link>
        {reel.authorUsername ? <p className="truncate text-[12px] text-brand-text/60">@{reel.authorUsername}</p> : null}
        {p?.bio ? <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-brand-text/80">{p.bio}</p> : null}

        {/* how the viewer stands with them */}
        {!isOwn && relationship ? (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {relationship.is_connection ? <Badge icon={<Link2 className="h-3 w-3" />}>Connected</Badge> : null}
            {relationship.followed_by ? <Badge icon={<UserCheck className="h-3 w-3" />}>Follows you</Badge> : null}
            {typeof mutualCount === "number" && mutualCount > 0 ? (
              <Badge icon={<Users className="h-3 w-3" />}>
                {mutualCount} mutual {mutualCount === 1 ? "connection" : "connections"}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* reach */}
      <dl className="reel-social-counts">
        <Stat label="Followers" value={followers} />
        <Stat label="Following" value={followingCount} />
        <Stat label="Circle" value={friends} />
      </dl>

      {/* actions */}
      {!isOwn ? (
        <div className="flex gap-2">
          {following !== undefined ? (
            <button
              type="button"
              disabled={followPending}
              onClick={onToggleFollow}
              className={`flex-1 rounded-full px-3 py-2 text-[13px] font-semibold transition disabled:opacity-60 ${
                following ? "border border-border bg-transparent hover:bg-brand-secondary" : "bg-brand-accent text-on-primary hover:opacity-90"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>
          ) : null}
          {relationship?.can_dm ? (
            <Link
              href={`/messenger?user=${encodeURIComponent(reel.authorId)}`}
              aria-label="Message"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition hover:bg-brand-secondary"
            >
              <MessageCircle className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      ) : null}
      <Link href={profileHref} className="reel-profile-link">View profile <ArrowUpRight size={16}/></Link>
      {reel.title ? <h2 className="text-sm font-semibold leading-relaxed">{reel.title}</h2> : null}

      {/* more reels from them */}
      {moreReels.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-text/50">More from {reel.authorUsername ? `@${reel.authorUsername}` : reel.authorName}</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {moreReels.map((post) => {
              const poster = post.cover_media_id ? `/v1/media/${post.cover_media_id}/serve` : null;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => onOpenReel(post.id)}
                  aria-label="Open reel"
                  className="relative aspect-square overflow-hidden rounded-lg bg-brand-secondary transition hover:opacity-90"
                >
                  {poster ? <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : null}
                  {typeof post.counts?.likes === "number" ? (
                    <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] font-semibold text-white">{formatCount(post.counts.likes)} ♥</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-brand-text/50">{label}</dt>
      <dd className="text-[14px] font-bold tabular-nums">{typeof value === "number" ? formatCount(value) : "—"}</dd>
    </div>
  );
}

function Badge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-secondary px-2 py-0.5 text-[11px] font-semibold text-brand-text/80">
      {icon}
      {children}
    </span>
  );
}
