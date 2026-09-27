"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2, Tv } from "lucide-react";

import { NoChannelCard } from "@/features/settings/channel/BrandingScreen";
import { useCreateChannelForm } from "@/features/settings/channel/useCreateChannelForm";
import { useMyChannel } from "@/hooks/useChannels";
import { useAuthUser } from "@/store/auth";

/** Content types the backend refuses without a channel (post-service `isLongVideoContentType`). */
export function needsChannel(contentType: string): boolean {
  return contentType === "long" || contentType === "podcast";
}

export type ChannelGateState = "signed-out" | "loading" | "error" | "no-channel" | "ready";

/** Pure: what the gate shows for a content type and the channel lookup's state. */
export function channelGateState(input: {
  contentType: string;
  signedIn: boolean;
  pending: boolean;
  error: boolean;
  hasChannel: boolean;
}): ChannelGateState {
  if (!needsChannel(input.contentType)) return "ready";
  if (!input.signedIn) return "signed-out";
  if (input.pending) return "loading";
  if (input.error) return "error";
  return input.hasChannel ? "ready" : "no-channel";
}

/*
  Asked first, not at publish: a long video or a podcast needs a channel,
  so the upload studio opens only once the creator has one. Without one,
  the channel form (the same one Branding uses) is the first screen, and
  creating it drops the creator straight into step one of the studio.
  Reels and shorts pass through untouched.
*/
export function ChannelGate({ contentType, children }: { contentType: string; children: ReactNode }) {
  const user = useAuthUser();
  const gated = needsChannel(contentType);
  const channelQuery = useMyChannel();
  const state = channelGateState({
    contentType,
    signedIn: Boolean(user),
    pending: gated && channelQuery.isPending,
    error: gated && channelQuery.isError,
    hasChannel: Boolean(channelQuery.data),
  });
  const form = useCreateChannelForm(state === "no-channel", { onCreated: () => void channelQuery.refetch() });

  if (state === "ready") return <>{children}</>;

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-10">
      {state === "loading" || (state === "no-channel" && !form) ? (
        <div className="flex items-center justify-center py-16 text-brand-text/60" aria-busy="true">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Checking your channel" />
        </div>
      ) : state === "signed-out" ? (
        <GateCard title="Sign in to upload" body="Videos are posted from your channel.">
          <Link href="/login?next=/posttube/upload" className="rounded-full bg-brand-ink px-4 py-2 text-[13px] font-semibold text-on-primary">
            Sign in
          </Link>
        </GateCard>
      ) : state === "error" ? (
        <GateCard title="Couldn't check your channel" body="Check your connection and try again.">
          <button type="button" onClick={() => void channelQuery.refetch()} className="rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-brand-text">
            Try again
          </button>
        </GateCard>
      ) : (
        <div className="space-y-4" data-channel-gate>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-secondary">
              <Tv className="h-4 w-4 text-brand-text" aria-hidden />
            </span>
            <div>
              <h1 className="text-[16px] font-bold text-brand-text">First, your channel</h1>
              <p className="mt-0.5 text-[12px] text-brand-text/70">
                Videos live on a channel. Create yours and the upload opens right after. It takes a name and a handle.
              </p>
            </div>
          </div>
          {form ? <NoChannelCard {...form} /> : null}
        </div>
      )}
    </div>
  );
}

function GateCard({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-brand-card p-6 text-center">
      <h1 className="text-[15px] font-bold text-brand-text">{title}</h1>
      <p className="mt-1 text-[12px] text-brand-text/70">{body}</p>
      <div className="mt-4 flex justify-center">{children}</div>
    </section>
  );
}
