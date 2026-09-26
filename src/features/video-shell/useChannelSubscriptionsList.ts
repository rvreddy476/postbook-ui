"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthUser } from "@/store/auth";

/*
  The viewer's subscribed channels, for the sidebar's "Subscriptions" group.
  GET /v1/channels/subscriptions?limit=12 → { data: [...], meta: { next_cursor } }.
  Lives here rather than in hooks/ because the shell is the only reader and
  the shape (channel nested under the subscription) is this endpoint's own.
*/

export interface SubscribedChannel {
  user_id: string;
  name: string;
  handle: string;
  avatar_url?: string | null;
  subscriber_count?: number;
}

export interface ChannelSubscriptionRow {
  channel: SubscribedChannel;
  notify_on?: string;
  subscribed_at?: string;
}

interface Response {
  data?: ChannelSubscriptionRow[] | null;
  meta?: { next_cursor?: string | null } | null;
}

export function useChannelSubscriptionsList(limit = 12) {
  const user = useAuthUser();
  return useQuery({
    queryKey: ["video-shell", "channel-subscriptions", user?.id ?? null, limit],
    queryFn: async () => {
      const res = await api.get<Response>("/v1/channels/subscriptions", { params: { limit } });
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      return {
        items: rows.filter((r): r is ChannelSubscriptionRow => !!r && !!r.channel && !!r.channel.handle),
        nextCursor: res.data?.meta?.next_cursor ?? null,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });
}
