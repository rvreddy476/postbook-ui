"use client";

import Link from "next/link";
import { Check, ExternalLink, Info, ListVideo, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useSubscribeChannel } from "@/hooks/useChannels";

import { boxOf, boxStyle } from "../../endScreenGeometry";
import { formatCount, formatDuration } from "../../model";
import {
  cardTarget,
  channelHref,
  endScreensAllowed,
  endScreenTarget,
  ImpressionLog,
  teaserCardAt,
  visibleEndScreenElements,
} from "../endScreenView";
import type { ElementEvent, ElementSurface, ViewerCard, ViewerEndScreenElement } from "../watchApi";
import "./video-elements.css";

/*
  The layer the player draws over its 16:9 frame (TubePlayer's `overlay`):
  end-screen elements in the creator's last seconds and the cards.

  - Elements sit at their fractions of the frame (percentages, so they
    scale with the frame in theater and fullscreen), fade in, and are
    links / buttons you can tab to. A video or collection tile shows its
    title on hover and focus; subscribe is the channel's avatar; a link
    tile shows the domain and title and opens in a new tab.
  - "Hide end screen" (top-right) hides them for the rest of this view.
  - Not drawn on frames under 480px wide (phones, the miniplayer); cards
    still are.
  - Cards: a teaser chip top-right for 5 s at each card's time, and an
    (i) button that opens the list. Hidden while end-screen elements are
    up and once the video has ended.
  - Every element records one impression the first time it is shown and
    a click when activated; `onEvent` is fire-and-forget.
*/

export interface VideoElementsOverlayProps {
  elements: readonly ViewerEndScreenElement[];
  cards: readonly ViewerCard[];
  positionMs: number;
  durationMs: number;
  ended: boolean;
  /** The 16:9 frame's width in px (the player measures it). */
  frameWidth: number;
  /** "Hide end screen" was pressed during this view. */
  hidden: boolean;
  onHide: () => void;
  onEvent: (surface: ElementSurface, id: string, event: ElementEvent) => void;
  signedIn: boolean;
  /** The viewer's own video: the subscribe circle is a plain channel link. */
  isOwner: boolean;
  /** A signed-out viewer pressed Subscribe. */
  onRequireUser?: () => void;
}

export function VideoElementsOverlay({
  elements,
  cards,
  positionMs,
  durationMs,
  ended,
  frameWidth,
  hidden,
  onHide,
  onEvent,
  signedIn,
  isOwner,
  onRequireUser,
}: VideoElementsOverlayProps) {
  const logRef = useRef<ImpressionLog | null>(null);
  if (!logRef.current) logRef.current = new ImpressionLog();
  const [panelOpen, setPanelOpen] = useState(false);

  const endAllowed = endScreensAllowed(frameWidth) && !hidden;
  const visible = useMemo(
    () => (endAllowed ? visibleEndScreenElements(elements, positionMs, { ended, durationMs }) : []),
    [elements, positionMs, ended, durationMs, endAllowed],
  );
  const cardsAllowed = cards.length > 0 && visible.length === 0 && !ended;
  const teaser = cardsAllowed && !panelOpen ? teaserCardAt(cards, positionMs) : null;

  const visibleKey = visible.map((e) => e.id).join(",");
  useEffect(() => {
    if (!visibleKey) return;
    for (const id of logRef.current!.take(visibleKey.split(",").map((id) => `es:${id}`))) onEvent("end-screens", id.slice(3), "impression");
    // onEvent is a stable fire-and-forget callback; the ids are the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  const teaserId = teaser?.id ?? "";
  useEffect(() => {
    if (!teaserId) return;
    for (const id of logRef.current!.take([`card:${teaserId}`])) onEvent("cards", id.slice(5), "impression");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teaserId]);

  useEffect(() => {
    if (!panelOpen) return;
    for (const id of logRef.current!.take(cards.map((c) => `card:${c.id}`))) onEvent("cards", id.slice(5), "impression");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  useEffect(() => {
    if (!cardsAllowed) setPanelOpen(false);
  }, [cardsAllowed]);

  if (visible.length === 0 && !cardsAllowed) return null;

  return (
    <div className="tube-elements" data-video-elements>
      {visible.map((el) => (
        <EndScreenElement
          key={el.id}
          el={el}
          onClick={() => onEvent("end-screens", el.id, "click")}
          signedIn={signedIn}
          isOwner={isOwner}
          onRequireUser={onRequireUser}
        />
      ))}
      {visible.length > 0 ? (
        <button type="button" className="tube-elements__hide" onClick={onHide} data-hide-end-screen>
          <X aria-hidden="true" /> Hide end screen
        </button>
      ) : null}
      {cardsAllowed ? (
        <div className="tube-cards" data-cards>
          {teaser ? (
            <button type="button" className="tube-cards__teaser" onClick={() => setPanelOpen(true)} data-card-teaser={teaser.id}>
              {teaser.teaser}
            </button>
          ) : null}
          <button
            type="button"
            className="tube-cards__info"
            aria-label={panelOpen ? "Close cards" : "Cards"}
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? <X aria-hidden="true" /> : <Info aria-hidden="true" />}
          </button>
          {panelOpen ? (
            <div className="tube-cards__panel" role="dialog" aria-label="Cards">
              <ul>
                {cards.map((card) => (
                  <li key={card.id}>
                    <CardRow card={card} onClick={() => onEvent("cards", card.id, "click")} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── one end-screen element ─────────────────────────────── */

function TargetLink({ href, external, className, style, label, onClick, children }: { href: string; external: boolean; className: string; style: React.CSSProperties; label: string; onClick: () => void; children: ReactNode }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style} aria-label={label} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style} aria-label={label} onClick={onClick}>
      {children}
    </Link>
  );
}

export function EndScreenElement({ el, onClick, signedIn, isOwner, onRequireUser }: { el: ViewerEndScreenElement; onClick: () => void; signedIn: boolean; isOwner: boolean; onRequireUser?: () => void }) {
  const style = boxStyle(boxOf(el.type, el.position));
  const target = endScreenTarget(el);
  if (!target) return null;

  if (el.type === "channel_subscribe" && el.channel && !isOwner) {
    return <SubscribeCircle el={el} style={style} onClick={onClick} signedIn={signedIn} onRequireUser={onRequireUser} />;
  }

  if (el.channel) {
    const c = el.channel;
    return (
      <TargetLink href={channelHref(c)} external={false} className="tube-es tube-es--circle" style={style} label={`Channel: ${c.name}`} onClick={onClick}>
        <Avatar url={c.avatarUrl} name={c.name} />
        <span className="tube-es__caption">{c.name}</span>
      </TargetLink>
    );
  }

  if (el.video) {
    const v = el.video;
    return (
      <TargetLink href={target.href} external={false} className="tube-es tube-es--tile" style={style} label={`Video: ${v.title}`} onClick={onClick}>
        {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" className="tube-es__thumb" loading="lazy" /> : <span className="tube-es__thumb" />}
        {v.durationSeconds > 0 ? <span className="tube-es__badge">{formatDuration(v.durationSeconds)}</span> : null}
        <span className="tube-es__title">
          <span className="tube-es__title-text">{v.title}</span>
          {v.channelName || v.viewCount > 0 ? (
            <span className="tube-es__meta">
              {[v.channelName, v.viewCount > 0 ? `${formatCount(v.viewCount)} views` : ""].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </span>
      </TargetLink>
    );
  }

  if (el.playlist) {
    const p = el.playlist;
    return (
      <TargetLink href={target.href} external={false} className="tube-es tube-es--tile" style={style} label={`Collection: ${p.title}`} onClick={onClick}>
        {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="tube-es__thumb" loading="lazy" /> : <span className="tube-es__thumb" />}
        <span className="tube-es__badge tube-es__badge--side">
          <ListVideo aria-hidden="true" />
          {p.itemCount > 0 ? p.itemCount : null}
        </span>
        <span className="tube-es__title">
          <span className="tube-es__title-text">{p.title}</span>
          <span className="tube-es__meta">Collection{p.itemCount > 0 ? ` · ${p.itemCount} ${p.itemCount === 1 ? "video" : "videos"}` : ""}</span>
        </span>
      </TargetLink>
    );
  }

  if (el.link) {
    const l = el.link;
    return (
      <TargetLink href={l.url} external className="tube-es tube-es--tile tube-es--link" style={style} label={`Link: ${l.title} (${l.domain}, opens in a new tab)`} onClick={onClick}>
        <span className="tube-es__link">
          <span className="tube-es__domain">
            <ExternalLink aria-hidden="true" /> {l.domain}
          </span>
          <span className="tube-es__link-title">{l.title}</span>
        </span>
      </TargetLink>
    );
  }
  return null;
}

function Avatar({ url, name }: { url: string; name: string }) {
  return url ? <img src={url} alt="" className="tube-es__avatar" loading="lazy" /> : <span className="tube-es__avatar tube-es__avatar--letter">{(name.replace(/^@/, "")[0] ?? "?").toUpperCase()}</span>;
}

function SubscribeCircle({ el, style, onClick, signedIn, onRequireUser }: { el: ViewerEndScreenElement; style: React.CSSProperties; onClick: () => void; signedIn: boolean; onRequireUser?: () => void }) {
  const c = el.channel!;
  const subscribe = useSubscribeChannel();
  const [subscribed, setSubscribed] = useState(c.isSubscribed);
  const ref = c.handle || c.userId;

  if (subscribed) {
    return (
      <TargetLink href={channelHref(c)} external={false} className="tube-es tube-es--circle is-subscribed" style={style} label={`${c.name}: Subscribed`} onClick={onClick}>
        <Avatar url={c.avatarUrl} name={c.name} />
        <span className="tube-es__sub is-on">
          <Check aria-hidden="true" /> Subscribed
        </span>
      </TargetLink>
    );
  }

  return (
    <button
      type="button"
      className="tube-es tube-es--circle"
      style={style}
      aria-label={`Subscribe to ${c.name}`}
      disabled={subscribe.isPending}
      onClick={() => {
        onClick();
        if (!signedIn) {
          onRequireUser?.();
          return;
        }
        setSubscribed(true);
        subscribe.mutate({ ref, subscribe: true, notifyOn: "all" }, { onError: () => setSubscribed(false) });
      }}
    >
      <Avatar url={c.avatarUrl} name={c.name} />
      <span className="tube-es__sub">Subscribe</span>
    </button>
  );
}

/* ── one card in the (i) panel ──────────────────────────── */

export function CardRow({ card, onClick }: { card: ViewerCard; onClick: () => void }) {
  const target = cardTarget(card);
  if (!target) return null;
  const thumb = card.video?.thumbnailUrl || card.playlist?.thumbnailUrl || "";
  const kind = card.video ? "Video" : card.playlist ? "Collection" : card.link?.domain || "Link";
  const body = (
    <>
      <span className="tube-cards__thumb">{thumb ? <img src={thumb} alt="" loading="lazy" /> : card.link ? <ExternalLink aria-hidden="true" /> : null}</span>
      <span className="tube-cards__text">
        <span className="tube-cards__title">{card.title}</span>
        <span className="tube-cards__meta">{kind}</span>
      </span>
    </>
  );
  return target.external ? (
    <a href={target.href} target="_blank" rel="noopener noreferrer" className="tube-cards__row" onClick={onClick}>
      {body}
    </a>
  ) : (
    <Link href={target.href} className="tube-cards__row" onClick={onClick}>
      {body}
    </Link>
  );
}
