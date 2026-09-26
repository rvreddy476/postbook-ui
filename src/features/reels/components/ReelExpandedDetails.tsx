"use client";

import Link from "next/link";
import { Avatar } from "@/components/LetterAvatar";
import { type ReelItem } from "../model";

/** Outside the video in wide fullscreen; the normal overlay serves small screens. */
export function ReelExpandedDetails({ reel }: { reel: ReelItem }) {
  return (
    <aside className="reel-expanded-details" aria-label="Reel details">
      <Link href={`/u/${reel.authorUsername || reel.authorId}`} className="flex items-center gap-3 font-semibold hover:underline">
        <Avatar src={reel.authorAvatarUrl || ""} name={reel.authorName} seed={reel.authorId} size="sm" />
        <span className="min-w-0 break-words">{reel.authorUsername ? `@${reel.authorUsername}` : reel.authorName}</span>
      </Link>
      {reel.title ? <h2 className="mt-4 break-words text-lg font-semibold leading-snug">{reel.title}</h2> : null}
      {reel.hashtags.length ? <p className="mt-3 flex flex-wrap gap-2 text-sm text-brand-accent">
        {reel.hashtags.slice(0, 6).map(tag => <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="hover:underline">#{tag}</Link>)}
      </p> : null}
    </aside>
  );
}
