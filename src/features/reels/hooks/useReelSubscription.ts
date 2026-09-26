"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchChannelSubscribed, setChannelSubscribed } from "@/features/reels/data/reelFeedApi";

/*
  A reel posted through a Tube channel gets Subscribe rather than Follow on
  the author row. State comes from GET /v1/channels/:handle/subscription,
  writes go to POST / DELETE /v1/channels/:handle/subscribe. The cache key
  is shared with the PostTube pages so a subscribe here is seen there.
*/

export function reelSubscriptionKey(handle: string | null | undefined) {
  return ["channel-subscription", handle ?? ""] as const;
}

export function useReelSubscription(handle: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const key = reelSubscriptionKey(handle);

  const state = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchChannelSubscribed(handle!, signal),
    enabled: Boolean(handle) && enabled,
    staleTime: 30_000,
    retry: false,
  });

  const toggle = useMutation({
    mutationFn: async (subscribed: boolean) => {
      await setChannelSubscribed(handle!, subscribed);
      return subscribed;
    },
    onMutate: (subscribed) => {
      const previous = qc.getQueryData<boolean>(key);
      qc.setQueryData<boolean>(key, subscribed);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData<boolean>(key, ctx?.previous ?? false);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["video-shell", "channel-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["posttube", "my-subscriptions"] });
    },
  });

  return {
    /** undefined until the first answer arrives — no button before then. */
    subscribed: state.data,
    pending: toggle.isPending,
    toggle: () => {
      if (!handle || toggle.isPending || state.data === undefined) return Promise.resolve();
      return toggle.mutateAsync(!state.data).then(() => undefined);
    },
  };
}
