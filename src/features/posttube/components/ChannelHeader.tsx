"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Users, Video } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { formatCount } from "../model";
import { channelAvatarUrl, channelBannerUrl, channelUserId, type ChannelInfo } from "../data/posttubeApi";

interface ChannelHeaderProps {
  channel: ChannelInfo | null;
  /** Fallbacks when the channel row is thin (e.g. a user without a channel). */
  fallbackName?: string;
  fallbackHandle?: string;
  fallbackAvatarUrl?: string;
  subscriberCount: number;
  videoCount?: number;
  /** Right-side controls: Subscribe + bell, or Upload + Settings for the owner. */
  actions?: ReactNode;
}

export function ChannelHeader({ channel, fallbackName, fallbackHandle, fallbackAvatarUrl, subscriberCount, videoCount, actions }: ChannelHeaderProps) {
  const name = channel?.name || fallbackName || "Channel";
  const handle = channel?.handle || fallbackHandle || "";
  const avatar = channelAvatarUrl(channel) || fallbackAvatarUrl;
  const banner = channelBannerUrl(channel);

  return (
    <div>
      <div className="relative h-40 overflow-hidden rounded-2xl bg-primary-ink">
        {banner ? <img src={banner} alt="" className="h-full w-full object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <div className="px-2 sm:px-4">
        <div className="relative -mt-12 flex flex-wrap items-end gap-5">
          <Avatar src={avatar} name={name} seed={channelUserId(channel) ?? name} size="xl" className="h-24 w-24 rounded-full border-4 border-brand-card shadow-lg" />
          <div className="min-w-0 flex-1 pb-2">
            <h1 className="text-[22px] font-bold text-brand-text">{name}</h1>
            {handle ? <p className="text-[13px] text-muted-foreground">@{handle}</p> : null}
            <div className="mt-1 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <strong className="text-brand-text">{formatCount(subscriberCount)}</strong> subscribers
              </span>
              {typeof videoCount === "number" ? (
                <span className="flex items-center gap-1">
                  <Video className="h-3.5 w-3.5" />
                  <strong className="text-brand-text">{formatCount(videoCount)}</strong> videos
                </span>
              ) : null}
            </div>
            {channel?.description ? <p className="mt-2 max-w-[640px] whitespace-pre-line text-[13px] text-brand-text">{channel.description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2 pb-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ChannelEmpty({ title, hint, cta }: { title: string; hint?: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-secondary">
        <Video className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="mt-4 text-[14px] font-semibold text-brand-text">{title}</p>
      {hint ? <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p> : null}
      {cta ? (
        <Link href={cta.href} className="mt-4 rounded-full bg-primary-ink px-5 py-2.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary-hover">
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
