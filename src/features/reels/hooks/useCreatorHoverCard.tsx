"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ReelCreatorCard, type ReelCreatorCardProps } from "@/features/reels/components/ReelCreatorCard";
import { HOVER_CARD_INITIAL, hoverCardDelay, hoverCardReducer } from "@/features/reels/hoverCard";
import { COARSE_POINTER_QUERY, useMediaQuery } from "@/features/reels/hooks/useMediaQuery";

/*
  The social graph as a hover card. One instance per stage serves both
  anchors — the author name in the overlay and the avatar at the top of the
  rail — because they mean the same person; the reducer remembers which
  anchor opened the card so it is positioned beside that one.

  Pointer: rests 350 ms on an anchor → open; leaves anchor and card for
  200 ms → close (hoverCard.ts). Keyboard: Enter on a focused anchor opens
  the card without following the link; Enter again follows it; Escape
  closes. Scroll or wheel anywhere closes, as does changing reel. On coarse
  pointers nothing here is wired and the anchors stay plain links.
*/

export interface HoverAnchorProps {
  ref: (el: HTMLElement | null) => void;
  onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
  onBlur: () => void;
  "aria-haspopup": "dialog";
  "aria-expanded": boolean;
}

const CARD_WIDTH = 280;
const GAP = 8;
const EDGE = 8;

export function useCreatorHoverCard(card: ReelCreatorCardProps | null): {
  anchorProps: (anchor: string) => HoverAnchorProps | undefined;
  card: ReactNode;
} {
  const coarse = useMediaQuery(COARSE_POINTER_QUERY);
  const [state, dispatch] = useReducer(hoverCardReducer, HOVER_CARD_INITIAL);
  const anchors = useRef(new Map<string, HTMLElement>());
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // The one timer, armed from the reducer's `pending`.
  useEffect(() => {
    const delay = hoverCardDelay(state);
    if (delay === null) return;
    const t = setTimeout(() => dispatch({ type: "timer" }), delay);
    return () => clearTimeout(t);
  }, [state]);

  // A new reel means a new author: the card never lingers over the wrong one.
  const reelId = card?.reel.id;
  useEffect(() => {
    dispatch({ type: "close-now" });
  }, [reelId]);

  // Escape, scroll and wheel close at once.
  useEffect(() => {
    if (!state.open) return;
    const close = () => dispatch({ type: "close-now" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("wheel", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [state.open]);

  // Position beside the anchor: below when there is room, otherwise above; kept inside the viewport.
  useLayoutEffect(() => {
    if (!state.open || !state.anchor) {
      setPos(null);
      return;
    }
    const anchor = anchors.current.get(state.anchor);
    const el = cardRef.current;
    if (!anchor || !el) return;
    const rect = anchor.getBoundingClientRect();
    const height = el.offsetHeight || 260;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.bottom + GAP + height <= vh - EDGE;
    const top = below ? rect.bottom + GAP : Math.max(EDGE, rect.top - GAP - height);
    const left = Math.min(Math.max(EDGE, rect.left), vw - CARD_WIDTH - EDGE);
    setPos({ left, top });
  }, [state.open, state.anchor]);

  const anchorProps = useCallback(
    (anchor: string): HoverAnchorProps | undefined => {
      if (coarse || !card) return undefined;
      return {
        ref: (el) => {
          if (el) anchors.current.set(anchor, el);
          else anchors.current.delete(anchor);
        },
        onPointerEnter: (e) => {
          if (e.pointerType === "touch") return;
          dispatch({ type: "anchor-enter", anchor });
        },
        onPointerLeave: (e) => {
          if (e.pointerType === "touch") return;
          dispatch({ type: "anchor-leave" });
        },
        onKeyDown: (e) => {
          if (e.key !== "Enter") return;
          if (state.open && state.anchor === anchor) return; // second Enter follows the link
          e.preventDefault();
          dispatch({ type: "open-now", anchor });
        },
        onBlur: () => {
          if (state.open && state.anchor === anchor) dispatch({ type: "anchor-leave" });
        },
        "aria-haspopup": "dialog",
        "aria-expanded": state.open && state.anchor === anchor,
      };
    },
    [coarse, card, state.open, state.anchor],
  );

  const node =
    card && state.open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={cardRef}
            role="dialog"
            aria-label={`About ${card.reel.authorName}`}
            className="reel-creator-popover"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
            onPointerEnter={() => dispatch({ type: "card-enter" })}
            onPointerLeave={() => dispatch({ type: "card-leave" })}
          >
            <ReelCreatorCard {...card} />
          </div>,
          document.fullscreenElement || document.body,
        )
      : null;

  return { anchorProps, card: node };
}
