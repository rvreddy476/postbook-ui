"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";

import { useChannelSubscriptionByRef, useSetChannelNotify, useSubscribeChannel } from "@/hooks/useChannels";

/*
  Subscribe / Subscribed + the bell. `channelRef` is a handle or a user id;
  `initialSubscribed` / `initialNotifyOn` come from the channel row when the
  feed hydrated them, and `GET /v1/channels/:ref/subscription` settles the
  truth once it answers. The bell is `PATCH .../subscription { notify_on }`.
*/

interface SubscribeButtonProps {
  channelRef: string | undefined;
  initialSubscribed?: boolean;
  initialNotifyOn?: string | null;
  /** Called after a successful toggle so the parent can bump its subscriber count. */
  onSubscribedChange?: (subscribed: boolean) => void;
  size?: "sm" | "md";
  /** Hide the button entirely when it is the viewer's own channel. */
  hidden?: boolean;
  /** The words on the button; the watch page says Follow / Following (our vocabulary). The API underneath is unchanged. */
  labels?: { off: string; on: string };
}

export function SubscribeButton({
  channelRef,
  initialSubscribed = false,
  initialNotifyOn = null,
  onSubscribedChange,
  size = "md",
  hidden = false,
  labels = { off: "Subscribe", on: "Subscribed" },
}: SubscribeButtonProps) {
  const subscriptionQuery = useChannelSubscriptionByRef(channelRef, !hidden);
  const subscribeMutation = useSubscribeChannel();
  const notifyMutation = useSetChannelNotify();

  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [notifyOn, setNotifyOn] = useState<"all" | "none">(initialNotifyOn === "none" ? "none" : "all");

  useEffect(() => {
    setSubscribed(initialSubscribed);
    setNotifyOn(initialNotifyOn === "none" ? "none" : "all");
  }, [channelRef, initialSubscribed, initialNotifyOn]);

  useEffect(() => {
    const d = subscriptionQuery.data;
    if (!d) return;
    setSubscribed(d.subscribed);
    if (d.subscribed) setNotifyOn(d.notify_on === "none" ? "none" : "all");
  }, [subscriptionQuery.data]);

  if (hidden || !channelRef) return null;

  const pending = subscribeMutation.isPending;
  const pad = size === "sm" ? "px-3.5 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]";
  const iconBox = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  const toggle = () => {
    const next = !subscribed;
    const prev = subscribed;
    setSubscribed(next);
    onSubscribedChange?.(next);
    subscribeMutation.mutate(
      { ref: channelRef, subscribe: next, notifyOn: "all" },
      {
        onError: () => {
          setSubscribed(prev);
          onSubscribedChange?.(prev);
        },
        onSuccess: () => {
          if (next) setNotifyOn("all");
        },
      },
    );
  };

  const toggleBell = () => {
    const next: "all" | "none" = notifyOn === "all" ? "none" : "all";
    const prev = notifyOn;
    setNotifyOn(next);
    notifyMutation.mutate({ ref: channelRef, notifyOn: next }, { onError: () => setNotifyOn(prev) });
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={subscribed}
        className={`rounded-full font-bold transition-colors disabled:opacity-60 ${pad} ${
          subscribed
            ? "bg-brand-secondary text-brand-text hover:bg-brand-divider"
            : "bg-primary-ink text-primary-foreground hover:bg-primary-hover"
        }`}
      >
        {subscribed ? labels.on : labels.off}
      </button>
      {subscribed ? (
        <button
          type="button"
          onClick={toggleBell}
          disabled={notifyMutation.isPending}
          aria-label={notifyOn === "all" ? "Turn off notifications" : "Turn on notifications"}
          title={notifyOn === "all" ? "All notifications" : "No notifications"}
          className={`flex ${iconBox} items-center justify-center rounded-full bg-brand-secondary text-brand-text transition-colors hover:bg-brand-divider disabled:opacity-60`}
        >
          {notifyMutation.isPending ? (
            <Bell className="h-4 w-4 animate-pulse" />
          ) : notifyOn === "all" ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}
