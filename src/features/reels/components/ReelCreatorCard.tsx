"use client";

import Link from "next/link";
import { BadgeCheck, Link2, MessageCircle, UserCheck, Users } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { formatCount, type ReelItem } from "@/features/reels/model";
import { useGraphCounts, useProfile } from "@/hooks/useProfile";
import { useMutualConnectionCounts } from "@/hooks/useConnections";
import type { Relationship } from "@/types/profile";

export interface ReelCreatorCardProps {
  reel: ReelItem;
  viewerId: string;
  isOwn: boolean;
  relationship: Relationship | undefined;
  followPending: boolean;
  onToggleFollow: () => void;
}

/*
  The creator card: who this is, where the viewer stands with them, and
  their reach — compact (280px) because it is a hover card now, not a
  column. It mounts only while the card is open, so the profile, graph
  counts and mutuals are fetched on demand. The name links to the profile,
  so there is no button for it. Everything reads from routes the profile
  page already uses.
*/
export function ReelCreatorCard({ reel, viewerId, isOwn, relationship, followPending, onToggleFollow }: ReelCreatorCardProps) {
  const profile = useProfile(reel.authorUsername);
  const counts = useGraphCounts(reel.authorId);
  const mutuals = useMutualConnectionCounts(isOwn ? undefined : viewerId || undefined, [reel.authorId]);

  const profileHref = reel.authorUsername ? `/u/${reel.authorUsername}` : `/u/${reel.authorId}`;
  const p = profile.data;
  const followers = counts.data?.follower_count ?? p?.follower_count;
  const followingCount = counts.data?.following_count ?? p?.following_count;
  const friends = counts.data?.friend_count ?? p?.friend_count;
  const mutualCount = mutuals.data?.get(reel.authorId);
  const following = relationship?.following;
  const chips: { key: string; icon: React.ReactNode; label: string }[] = [];
  if (!isOwn && relationship?.is_connection) chips.push({ key: "connected", icon: <Link2 className="h-3 w-3" />, label: "Connected" });
  if (!isOwn && relationship?.followed_by) chips.push({ key: "follows-you", icon: <UserCheck className="h-3 w-3" />, label: "Follows you" });
  if (!isOwn && typeof mutualCount === "number" && mutualCount > 0) {
    chips.push({ key: "mutual", icon: <Users className="h-3 w-3" />, label: `${mutualCount} mutual` });
  }

  return (
    <div data-creator-card="true" className="reel-creator-card" onClick={(e) => e.stopPropagation()}>
      <div className="reel-creator-head">
        <Link href={profileHref} className="shrink-0" aria-label={`${reel.authorName}'s profile`}>
          <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="lg" />
        </Link>
        <div className="reel-creator-who">
          <Link href={profileHref} className="reel-creator-name">
            <span className="truncate">{p?.display_name || reel.authorName}</span>
            {p?.is_verified ? <BadgeCheck className="h-4 w-4 shrink-0" aria-label="Verified" /> : null}
          </Link>
          {reel.authorUsername ? <span className="reel-creator-handle">@{reel.authorUsername}</span> : null}
        </div>
      </div>

      {p?.bio ? <p className="reel-creator-bio">{p.bio}</p> : null}

      <dl className="reel-social-counts" aria-label="Reach">
        <Stat label="Followers" value={followers} />
        <Stat label="Following" value={followingCount} />
        <Stat label="Circle" value={friends} />
      </dl>

      {chips.length > 0 ? (
        <div className="reel-creator-graph">
          {chips.map((c) => (
            <span key={c.key} className="reel-creator-chip">
              {c.icon}
              {c.label}
            </span>
          ))}
        </div>
      ) : null}

      {!isOwn ? (
        <div className="reel-creator-actions">
          {following !== undefined ? (
            <button
              type="button"
              disabled={followPending}
              onClick={onToggleFollow}
              aria-pressed={following}
              className={`reel-creator-follow ${following ? "is-on" : ""}`}
            >
              {following ? "Following" : "Follow"}
            </button>
          ) : null}
          {relationship?.can_dm ? (
            <Link href={`/messenger?user=${encodeURIComponent(reel.authorId)}`} className="reel-creator-message">
              <MessageCircle className="h-3.5 w-3.5" /> Message
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <dd className="reel-social-counts__value">{typeof value === "number" ? formatCount(value) : "—"}</dd>
      <dt className="reel-social-counts__label">{label}</dt>
    </div>
  );
}
