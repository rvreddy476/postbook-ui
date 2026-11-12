/*
  The generateMetadata of every shareable route, server only: read the
  public API signed out (publicFetch), build the card (siteMeta), and fall
  back to the neutral card for anything the public may not see or that did
  not answer. The routes themselves stay one line each.
*/

import type { Metadata } from "next";

import { publicFetch, publicFetchEnvelope } from "./publicFetch";
import {
  cardMetadata,
  channelCard,
  hashtagCard,
  isShareId,
  isShareRef,
  neutralMetadata,
  noteCard,
  postCard,
  profileCard,
  shareBasesFromProcess,
  soundCard,
  type WireChannel,
  type WirePost,
  type WireProfile,
  type WireSound,
} from "./siteMeta";

/** /post/<id> and /posttube/watch/<id>: GET /v1/posts/:id. */
export async function postPageMetadata(postId: string, path: string): Promise<Metadata> {
  const bases = shareBasesFromProcess();
  if (!isShareId(postId)) return neutralMetadata(bases);
  const { data } = await publicFetch<WirePost>(`/v1/posts/${encodeURIComponent(postId)}`);
  const card = postCard(data, bases, path);
  return card ? cardMetadata(card, bases) : neutralMetadata(bases, path);
}

/** /u/<handle or id>: GET /v1/profiles/by-username/:handle (or /v1/profiles/:id). */
export async function profilePageMetadata(handle: string): Promise<Metadata> {
  const bases = shareBasesFromProcess();
  let ref = handle;
  try {
    ref = decodeURIComponent(handle);
  } catch {
    /* keep as typed */
  }
  ref = ref.replace(/^@/, "");
  if (!isShareRef(ref)) return neutralMetadata(bases);
  const path = isShareId(ref) ? `/v1/profiles/${ref}` : `/v1/profiles/by-username/${encodeURIComponent(ref)}`;
  const { data } = await publicFetch<WireProfile>(path);
  const card = profileCard(data, bases);
  return card ? cardMetadata(card, bases) : neutralMetadata(bases, `/u/${encodeURIComponent(ref)}`);
}

/** /posttube/channel/<ref> and /channel/<handle>: GET /v1/channels/:ref. */
export async function channelPageMetadata(ref: string, pathFor: (ref: string) => string): Promise<Metadata> {
  const bases = shareBasesFromProcess();
  if (!isShareRef(ref)) return neutralMetadata(bases);
  const { data } = await publicFetch<WireChannel>(`/v1/channels/${encodeURIComponent(ref)}`);
  const card = channelCard(data, bases, pathFor);
  return card ? cardMetadata(card, bases) : neutralMetadata(bases, pathFor(ref));
}

/** /reels/sound/<id>: GET /v1/audio/:id, then the reel it came from for its cover. */
export async function soundPageMetadata(soundId: string): Promise<Metadata> {
  const bases = shareBasesFromProcess();
  if (!isShareId(soundId)) return neutralMetadata(bases);
  const path = `/reels/sound/${encodeURIComponent(soundId)}`;
  const { data: sound } = await publicFetch<WireSound>(`/v1/audio/${encodeURIComponent(soundId)}`);
  if (!sound) return neutralMetadata(bases, path);
  const originId = sound.source_post_id;
  const origin = isShareId(originId) ? (await publicFetch<WirePost>(`/v1/posts/${originId}`)).data : null;
  const card = soundCard(sound, origin, bases);
  return card ? cardMetadata(card, bases) : neutralMetadata(bases, path);
}

interface HashtagPostsBody {
  data?: WirePost[] | null;
  meta?: { total?: number | null } | null;
}

/** /hashtag/<tag>: GET /v1/hashtags/:tag/posts?limit=1 for the count and the first cover. */
export async function hashtagPageMetadata(segment: string): Promise<Metadata> {
  const bases = shareBasesFromProcess();
  let tag = segment;
  try {
    tag = decodeURIComponent(segment);
  } catch {
    /* keep as typed */
  }
  tag = tag.replace(/^#/, "").trim();
  if (!tag || tag.length > 100 || /[\s/?#]/.test(tag)) return neutralMetadata(bases);
  const path = `/hashtag/${encodeURIComponent(tag)}`;
  // The envelope whole: `meta.total` sits beside `data`.
  const { data } = await publicFetchEnvelope<HashtagPostsBody>(`/v1/hashtags/${encodeURIComponent(tag)}/posts?limit=1&sort=top`);
  const first = Array.isArray(data?.data) ? data.data[0] ?? null : null;
  const card = hashtagCard(tag, data?.meta?.total ?? null, first, bases);
  return card ? cardMetadata(card, bases) : neutralMetadata(bases, path);
}

/** /echo/note/<id>: GET /v1/notes/:id. A closed Echo (503) or a hidden note gets the neutral card. */
export async function notePageMetadata(noteId: string): Promise<Metadata> {
  const bases = shareBasesFromProcess();
  if (!isShareId(noteId)) return neutralMetadata(bases);
  const { data } = await publicFetch<WirePost>(`/v1/notes/${encodeURIComponent(noteId)}`);
  const card = noteCard(data, bases);
  return card ? cardMetadata(card, bases) : neutralMetadata(bases, `/echo/note/${encodeURIComponent(noteId)}`);
}
