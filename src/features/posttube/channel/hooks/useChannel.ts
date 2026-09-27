"use client";

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import {
  fetchChannel,
  fetchChannelCollections,
  fetchChannelPosts,
  fetchChannelVideos,
  fetchFeaturedVideo,
  fetchMyChannel,
  reportChannel,
  type ChannelReportReason,
} from "../channelApi";

/*
  The channel page's queries. The channel keys sit under "channel-ref" so
  a Branding save (useUpdateChannel invalidates ["channel-ref"]) refreshes
  the masthead too; they hold the normalised view, so they never share a
  key with the raw ChannelInfo the older hooks cache.
*/
export const CHANNEL_KEYS = {
  byRef: (ref: string) => ["channel-ref", "screen", "ref", ref] as const,
  mine: ["channel-ref", "screen", "me"] as const,
  videos: (ownerId: string, type: "long_video" | "flick") => ["posttube", "channel", ownerId, type] as const,
  posts: (ownerId: string) => ["posttube", "channel", ownerId, "post"] as const,
  collections: (ownerId: string, isOwner: boolean) => ["posttube", "channel", ownerId, "collections", isOwner ? "owner" : "visitor"] as const,
  featured: (postId: string) => ["posttube", "channel", "featured", postId] as const,
};

export function useChannelLookup(mode: { kind: "own"; enabled: boolean } | { kind: "public"; ref: string }) {
  const own = mode.kind === "own";
  return useQuery({
    queryKey: own ? CHANNEL_KEYS.mine : CHANNEL_KEYS.byRef(mode.ref),
    queryFn: () => (own ? fetchMyChannel() : fetchChannel(mode.ref)),
    enabled: own ? mode.enabled : !!mode.ref,
    // Own: always re-read on mount, so a channel just made through the upload gate shows at once.
    staleTime: own ? 0 : 60_000,
    retry: false,
  });
}

export function useChannelVideos(ownerId: string | undefined, type: "long_video" | "flick", enabled: boolean) {
  return useInfiniteQuery({
    queryKey: CHANNEL_KEYS.videos(ownerId ?? "", type),
    queryFn: ({ pageParam }) => fetchChannelVideos(ownerId!, type, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!ownerId && enabled,
    staleTime: 60_000,
  });
}

export function useChannelPosts(ownerId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: CHANNEL_KEYS.posts(ownerId ?? ""),
    queryFn: ({ pageParam }) => fetchChannelPosts(ownerId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!ownerId && enabled,
    staleTime: 60_000,
  });
}

export function useChannelCollections(ownerId: string | undefined, isOwner: boolean, enabled: boolean) {
  return useQuery({
    queryKey: CHANNEL_KEYS.collections(ownerId ?? "", isOwner),
    queryFn: () => fetchChannelCollections(ownerId!, isOwner),
    enabled: !!ownerId && enabled,
    staleTime: 60_000,
  });
}

export function useFeaturedVideo(postId: string | null | undefined) {
  return useQuery({
    queryKey: CHANNEL_KEYS.featured(postId ?? ""),
    queryFn: () => fetchFeaturedVideo(postId!),
    enabled: !!postId,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useReportChannel() {
  return useMutation({
    mutationFn: ({ ownerId, reason, details }: { ownerId: string; reason: ChannelReportReason; details?: string }) => reportChannel(ownerId, reason, details),
  });
}
