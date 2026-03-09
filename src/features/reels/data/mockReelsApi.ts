import { v4 as uuidv4 } from "uuid";

import type { CommentsAroundResponse, CursorPage, Reel, ReelComment } from "@/features/reels/types";

const MOCK_LATENCY_MS = 110;
const DEFAULT_REEL_PAGE_SIZE = 8;
const DEFAULT_COMMENT_PAGE_SIZE = 40;

const VIDEO_SOURCES = [
  {
    video_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    thumbnail_url: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
  },
  {
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
  },
  {
    video_url: "https://test-streams.mux.dev/test_001/stream.m3u8",
    thumbnail_url: "https://images.unsplash.com/photo-1475724017904-b712052c192a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1496449903678-68ddcb189a24?auto=format&fit=crop&w=1200&q=80",
  },
] as const;

const AUTHORS = [
  { id: "auth-001", name: "Ari Vale", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=AriVale" },
  { id: "auth-002", name: "Nova Raye", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=NovaRaye" },
  { id: "auth-003", name: "Kian Vox", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=KianVox" },
  { id: "auth-004", name: "Jules Frame", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=JulesFrame" },
  { id: "auth-005", name: "Mina Orbit", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=MinaOrbit" },
] as const;

const CAPTIONS = [
  "Chrome rain, neon nights, and one clean camera move.",
  "Backstage rehearsal with only practical lights and one lens.",
  "Street theater energy. No cuts. Full momentum.",
  "The city is louder at midnight and somehow softer too.",
  "Sound off first. Watch the rhythm in the edit.",
  "One take. Two cameras. Three seconds of perfect timing.",
] as const;

const HASHTAG_SETS = [
  ["postgram", "reels", "theater"],
  ["cinematic", "nightshift", "city"],
  ["boost", "creatorflow", "live"],
  ["motion", "framestudy", "vertical"],
  ["storyline", "camera", "colorgrade"],
  ["hype", "shortform", "studio"],
] as const;

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function encodeCursor(index: number): string {
  return String(index);
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const parsed = Number(cursor);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildInitialReels(): Reel[] {
  return Array.from({ length: 24 }, (_, index) => {
    const source = VIDEO_SOURCES[index % VIDEO_SOURCES.length];
    const author = AUTHORS[index % AUTHORS.length];
    const caption = CAPTIONS[index % CAPTIONS.length];
    const hashtags = HASHTAG_SETS[index % HASHTAG_SETS.length];
    return {
      reel_id: uuidv4(),
      author_id: author.id,
      author_name: author.name,
      author_avatar_url: author.avatar,
      video_url: source.video_url,
      thumbnail_url: source.thumbnail_url,
      caption,
      hashtags: [...hashtags],
      like_count: 4200 + index * 113,
      comment_count: 180 + index * 4,
      share_count: 240 + index * 7,
      viewer_has_boosted: index % 5 === 0,
      viewer_has_saved: index % 6 === 0,
    };
  });
}

function buildInitialComments(reel: Reel, seed: number): ReelComment[] {
  const total = 180 + (seed % 6) * 15;
  const startTs = Date.now() - (total + 24) * 60_000;
  return Array.from({ length: total }, (_, idx) => {
    const author = AUTHORS[(idx + seed) % AUTHORS.length];
    return {
      comment_id: uuidv4(),
      author_id: author.id,
      author_name: author.name,
      text: `Scene take ${idx + 1}: ${[
        "clean transition",
        "camera arc is unreal",
        "boosting this edit",
        "sound design is sharp",
        "timing is perfect",
      ][idx % 5]}.`,
      created_at: new Date(startTs + idx * 60_000).toISOString(),
    };
  });
}

const reelStore = buildInitialReels();
const commentsStore = new Map<string, ReelComment[]>(
  reelStore.map((reel, idx) => [reel.reel_id, buildInitialComments(reel, idx)])
);

reelStore.forEach((reel) => {
  const comments = commentsStore.get(reel.reel_id);
  reel.comment_count = comments?.length ?? reel.comment_count;
});

function getReelIndex(reelId: string): number {
  return reelStore.findIndex((reel) => reel.reel_id === reelId);
}

export async function getReelsPage(params?: {
  cursor?: string;
  limit?: number;
}): Promise<CursorPage<Reel>> {
  await delay();
  const limit = clamp(params?.limit ?? DEFAULT_REEL_PAGE_SIZE, 1, 20);
  const offset = decodeCursor(params?.cursor);
  const items = reelStore.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    items,
    next_cursor: nextOffset < reelStore.length ? encodeCursor(nextOffset) : undefined,
  };
}

export async function getReelById(reelId: string): Promise<Reel | null> {
  await delay(50);
  return reelStore.find((reel) => reel.reel_id === reelId) ?? null;
}

export async function getCommentsPage(params: {
  reelId: string;
  cursor?: string;
  limit?: number;
}): Promise<CursorPage<ReelComment>> {
  await delay();
  const limit = clamp(params.limit ?? DEFAULT_COMMENT_PAGE_SIZE, 1, 120);
  const offset = decodeCursor(params.cursor);
  const comments = commentsStore.get(params.reelId) ?? [];
  const items = comments.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    items,
    next_cursor: nextOffset < comments.length ? encodeCursor(nextOffset) : undefined,
  };
}

export async function getCommentsAround(commentId: string): Promise<CommentsAroundResponse> {
  await delay();
  for (const [reelId, comments] of commentsStore.entries()) {
    const focusIndex = comments.findIndex((comment) => comment.comment_id === commentId);
    if (focusIndex >= 0) {
      const start = Math.max(0, focusIndex - 18);
      const end = Math.min(comments.length, focusIndex + 19);
      return {
        reel_id: reelId,
        focus_comment_id: commentId,
        comments: comments.slice(start, end),
        focus_index: focusIndex - start,
      };
    }
  }
  throw new Error("Comment not found");
}

// Mock GET /comments/around?comment_id=UUID
export async function getCommentsAroundByCommentId(params: {
  comment_id: string;
}): Promise<CommentsAroundResponse> {
  return getCommentsAround(params.comment_id);
}

export async function createComment(params: {
  reelId: string;
  text: string;
  authorId?: string;
  authorName?: string;
}): Promise<ReelComment> {
  await delay(80);
  const trimmed = params.text.trim();
  if (!trimmed) {
    throw new Error("Comment cannot be empty");
  }
  const reelIndex = getReelIndex(params.reelId);
  if (reelIndex < 0) {
    throw new Error("Reel not found");
  }

  const comment: ReelComment = {
    comment_id: uuidv4(),
    author_id: params.authorId ?? "viewer-001",
    author_name: params.authorName ?? "You",
    text: trimmed,
    created_at: new Date().toISOString(),
  };

  const existing = commentsStore.get(params.reelId) ?? [];
  const next = [...existing, comment];
  commentsStore.set(params.reelId, next);
  reelStore[reelIndex] = {
    ...reelStore[reelIndex],
    comment_count: next.length,
  };
  return comment;
}

export function createRealtimeComment(reelId: string): ReelComment {
  const reel = reelStore[getReelIndex(reelId)];
  const author = AUTHORS[Math.floor(Math.random() * AUTHORS.length)] ?? AUTHORS[0];
  const comment: ReelComment = {
    comment_id: uuidv4(),
    author_id: author.id,
    author_name: author.name,
    text: [
      "This transition deserves a boost.",
      "Lighting on this shot is elite.",
      "Replay value is high.",
      "That timing was perfect.",
      "Posting this to my circle now.",
    ][Math.floor(Math.random() * 5)],
    created_at: new Date().toISOString(),
  };

  const existing = commentsStore.get(reelId) ?? [];
  commentsStore.set(reelId, [...existing, comment]);
  if (reel) {
    reel.comment_count = (reel.comment_count ?? existing.length) + 1;
  }
  return comment;
}
