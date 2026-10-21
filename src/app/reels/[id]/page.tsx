import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { postPageMetadata } from "@/features/share/routeMetadata";
import { isShareRefId, SHARE_REF_PARAM, SHARE_SOURCE, SHARE_SOURCE_PARAM } from "@/features/share/shareRef";

type Props = { params: Promise<{ id: string }> };

/** The middleware's presence cookie (src/middleware.ts SESSION_FLAG_COOKIE). */
const SESSION_FLAG_COOKIE = "pb_auth";

/*
  Single-reel permalink. Signed in → the stage, pinned on that reel (it
  reads `reelId`; it also accepts the older `reel` and `postId` spellings
  other pages still emit). Signed out (21 Oct 2026) → the public /post/<id>
  page, which plays a public reel with no session: the stage is gated, and
  a shared link must never end on /login. The query (a share ref) rides
  along either way.

  The preview is the post's own, built here so a crawler that does not
  follow redirects still sees the reel's title and cover.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return postPageMetadata(id, `/reels/${encodeURIComponent(id)}`);
}

export default async function ReelPermalinkPage({ params, searchParams }: Props & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  // Only the share ref (and its source) rides along; nothing else in the query does.
  const carried = new URLSearchParams();
  const ref = typeof query[SHARE_REF_PARAM] === "string" ? query[SHARE_REF_PARAM] : null;
  if (isShareRefId(ref)) {
    carried.set(SHARE_REF_PARAM, ref);
    carried.set(SHARE_SOURCE_PARAM, SHARE_SOURCE);
  }
  const jar = await cookies();
  if (jar.get(SESSION_FLAG_COOKIE)?.value) {
    carried.set("reelId", id);
    redirect(`/reels?${carried.toString()}`);
  }
  const tail = carried.toString();
  redirect(`/post/${encodeURIComponent(id)}${tail ? `?${tail}` : ""}`);
}
