"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Palette } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { SubscribeButton } from "../../components/SubscribeButton";
import { formatCount } from "../../model";
import type { ChannelView } from "../channelApi";
import { aboutNeedsToggle, plural } from "../channelModel";
import { ChannelLinks } from "./ChannelLinks";
import { ChannelMoreMenu } from "./ChannelMoreMenu";

/*
  The compact masthead (not a hero): an optional 3:1 banner strip above,
  then one row — the 72px avatar; the 18px name, a 12px meta line
  (@handle · followers · videos), the description clamped to two lines
  with a "more" toggle and the link pills; on the right Follow + bell for
  a visitor, Branding and Creator Hub for the owner, and More for both
  (the owner's More holds the RSS feed row only).
*/

export interface ChannelMastheadProps {
  channel: ChannelView;
  isOwner: boolean;
  signedIn: boolean;
  followerCount: number;
  onFollowChange?: (following: boolean) => void;
  onShare?: () => void;
  onReport?: () => void;
  /** Opens the RSS feed address (the More menu's "RSS feed" row). */
  onFeed?: () => void;
}

export function ChannelMasthead({ channel, isOwner, signedIn, followerCount, onFollowChange, onShare, onReport, onFeed }: ChannelMastheadProps) {
  const [expanded, setExpanded] = useState(false);
  const meta: string[] = [];
  if (channel.handle) meta.push(`@${channel.handle}`);
  if (!channel.thin) meta.push(plural(followerCount, "subscriber", "subscribers", formatCount));
  if (typeof channel.counts.videos === "number") meta.push(plural(channel.counts.videos, "video", "videos", formatCount));
  const followRef = channel.handle || channel.userId;
  const toggle = aboutNeedsToggle(channel.about);

  return (
    <header className="tube-chan-head">
      {channel.bannerUrl ? (
        <div className="tube-chan-head__banner">
          <img src={channel.bannerUrl} alt="" />
        </div>
      ) : null}
      <div className="tube-chan-head__row">
        <Avatar src={channel.avatarUrl} name={channel.name} seed={channel.userId} size="xl" className="tube-chan-head__avatar" />
        <div className="tube-chan-head__id">
          <h1 className="tube-chan-head__name">{channel.name}</h1>
          {meta.length > 0 ? (
            <p className="tube-chan-head__meta">
              {meta.map((m, i) => (
                <span key={m}>
                  {i > 0 ? <span aria-hidden> · </span> : null}
                  {m}
                </span>
              ))}
            </p>
          ) : null}
          {channel.about ? (
            <div className="tube-chan-head__about-wrap">
              <p id="tube-chan-about" className={`tube-chan-head__about${expanded ? " is-open" : ""}`}>
                {channel.about}
              </p>
              {toggle ? (
                <button type="button" className="tube-chan-head__toggle" aria-expanded={expanded} aria-controls="tube-chan-about" onClick={() => setExpanded((e) => !e)}>
                  {expanded ? "less" : "more"}
                </button>
              ) : null}
            </div>
          ) : null}
          <ChannelLinks links={channel.links} />
        </div>
        <div className="tube-chan-head__actions">
          {isOwner ? (
            <>
              <Link href="/settings/channel" className="tube-chan-btn">
                <Palette aria-hidden />
                <span>Branding</span>
              </Link>
              <Link href="/posttube/hub" className="tube-chan-btn is-primary">
                <LayoutDashboard aria-hidden />
                <span>Creator Hub</span>
              </Link>
              <ChannelMoreMenu signedIn={signedIn} isOwner hasFeed={!channel.thin} onShare={() => onShare?.()} onReport={() => onReport?.()} onFeed={() => onFeed?.()} />
            </>
          ) : (
            <>
              <SubscribeButton
                channelRef={followRef}
                initialSubscribed={channel.isFollowing}
                initialNotifyOn={channel.notifyOn}
                hidden={!signedIn || channel.thin}
                size="sm"
                labels={{ off: "Subscribe", on: "Subscribed" }}
                onSubscribedChange={onFollowChange}
              />
              <ChannelMoreMenu signedIn={signedIn} hasFeed={!channel.thin} onShare={() => onShare?.()} onReport={() => onReport?.()} onFeed={() => onFeed?.()} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
