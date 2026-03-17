"use client";

import { useEffect, useRef } from "react";
import { Loader2, Tv } from "lucide-react";
import { useMyChannels } from "@/hooks/useChannels";
import { useEnsurePublisher } from "@/hooks/useEnsurePublisher";
import type { Channel } from "@/types/profile";

interface ChannelGateProps {
  children: (channel: Channel) => React.ReactNode;
}

/**
 * Zero-friction gate for content-creation pages.
 * If the user has no channel, auto-calls ensure-publisher to create one instantly.
 * No forms, no user input needed.
 */
export function ChannelGate({ children }: ChannelGateProps) {
  const { data: channels, isLoading, isError, refetch } = useMyChannels();
  const ensurePublisher = useEnsurePublisher();
  const triggered = useRef(false);

  const channel = channels?.[0];
  const needsChannel = !isLoading && !channel && !isError;

  // Auto-call ensure-publisher when user has no channel
  useEffect(() => {
    if (!needsChannel) return;
    if (triggered.current) return;
    if (ensurePublisher.isPending) return;
    triggered.current = true;
    ensurePublisher.mutate(undefined, {
      onSuccess: (data) => {
        if (data.was_new_channel) {
          try {
            sessionStorage.setItem("atpost:show_complete_banner", "1");
          } catch {}
        }
      },
    });
  }, [needsChannel, ensurePublisher]);

  // Already has channel — render immediately.
  if (channel) {
    return <>{children(channel)}</>;
  }

  // Loading channels query or auto-creating channel
  if (isLoading || ensurePublisher.isPending || needsChannel) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-brand-card">
        <Loader2 className="h-6 w-6 animate-spin text-brand-text/60" />
        {(ensurePublisher.isPending || needsChannel) && (
          <p className="text-[13px] text-brand-text/60">Setting up your channel…</p>
        )}
      </div>
    );
  }

  // Error state
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-brand-card">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <Tv className="h-7 w-7 text-brand-text/60" />
      </div>
      <p className="text-[14px] text-brand-highlight">
        {ensurePublisher.isError
          ? "Could not set up your channel. Please try again."
          : isError
            ? "Could not load your channel. Please try again."
            : "Something went wrong."}
      </p>
      <button
        type="button"
        onClick={() => {
          triggered.current = false;
          ensurePublisher.reset();
          refetch();
        }}
        className="rounded-full bg-slate-900 px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-800"
      >
        Retry
      </button>
    </div>
  );
}
