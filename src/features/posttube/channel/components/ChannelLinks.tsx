"use client";

import { useState } from "react";
import { Link2, Mail } from "lucide-react";

import { Popover } from "@/features/reels/components/Popover";
import type { ChannelLinkView } from "../channelApi";
import { splitLinks } from "../channelModel";

/*
  The creator's links as small pills: the first two inline, the rest
  behind "+N more", which opens the reels popover (a bottom sheet on
  phones) listing every link. External links open in a new tab with
  rel=noopener noreferrer; only http(s) URLs ever get here (channelApi).
*/

function linkProps(l: ChannelLinkView) {
  return l.external ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

function LinkIcon({ link }: { link: ChannelLinkView }) {
  return link.external ? <Link2 aria-hidden /> : <Mail aria-hidden />;
}

export function ChannelLinks({ links, visible = 2 }: { links: readonly ChannelLinkView[]; visible?: number }) {
  const [open, setOpen] = useState(false);
  if (links.length === 0) return null;
  const { shown, more } = splitLinks(links, visible);

  return (
    <div className="tube-chan-links">
      {shown.map((l) => (
        <a key={l.href} href={l.href} className="tube-chan-links__pill" title={l.href} {...linkProps(l)}>
          <LinkIcon link={l} />
          <span>{l.label}</span>
        </a>
      ))}
      {more > 0 ? (
        <span className="tube-chan-links__more-wrap">
          <button
            type="button"
            className="tube-chan-links__pill is-more"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            +{more} more
          </button>
          <Popover open={open} onClose={() => setOpen(false)} align="left" placement="down" label="Links" className="reel-more-menu tube-chan-menu">
            <div className="reel-more-menu__list">
              {links.map((l) => (
                <a key={l.href} href={l.href} role="menuitem" className="reel-more-menu__row" onClick={() => setOpen(false)} {...linkProps(l)}>
                  <span className="reel-more-menu__icon">
                    <LinkIcon link={l} />
                  </span>
                  <span className="reel-more-menu__label">
                    <span className="reel-more-menu__title">{l.label}</span>
                    <span className="reel-more-menu__hint">{l.external ? l.href : l.href.replace(/^mailto:/, "")}</span>
                  </span>
                </a>
              ))}
            </div>
          </Popover>
        </span>
      ) : null}
    </div>
  );
}
