"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";

import { useMyProfile } from "@/hooks/useEditProfile";
import { REELS_MORE_PANEL, REELS_MORE_SETTINGS, type MorePanelItem } from "./nav";
import { useVideoShell } from "./useVideoShell";

interface VideoMorePanelProps {
  /** ✕ (and Escape, handled by the shell): back to the nav list. */
  onClose: () => void;
  /** A drawer closes itself after a link is followed. */
  onNavigate?: () => void;
}

/*
  The More panel: what the last nav entry opens, in the same column, in
  place of the nav list (or beside the icon rail). It draws only its own
  video-more__* classes: the rail's rules hide .video-nav__label, and when
  the panel borrowed those classes it showed icons only beside the rail
  (founder's screenshot, 17 Oct).

  It is the SHORT first level (founder, 17 Oct): who you are (to your
  profile), the apps as tiles, the two short lists from nav.ts, then one
  "Settings & privacy" row to the /settings page — where the appearance
  switch, Log out and every other setting now live — and the legal links.
*/
export function VideoMorePanel({ onClose, onNavigate }: VideoMorePanelProps) {
  const { openExplore } = useVideoShell();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Opened by a click on "More": focus moves into the panel, to its ✕.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /** A link, or the Explore launcher; `className` picks tile or row. */
  const target = (item: MorePanelItem, className: string, children: ReactNode) => {
    if (item.action === "explore") {
      return (
        <button type="button" className={className} onClick={() => { onNavigate?.(); openExplore(); }} aria-haspopup="dialog">
          {children}
        </button>
      );
    }
    return (
      <Link href={item.href ?? "/"} className={className} onClick={onNavigate}>
        {children}
      </Link>
    );
  };

  const row = (item: MorePanelItem) => {
    const Icon = item.icon;
    return target(item, "video-more__row", (
      <>
        <span className="video-more__row-icon"><Icon size={18} strokeWidth={1.75} aria-hidden /></span>
        <span className="video-more__label">{item.label}</span>
        <ChevronRight className="video-more__chevron" size={16} strokeWidth={1.75} aria-hidden />
      </>
    ));
  };

  return (
    <div className="video-more" role="region" aria-label="More">
      <div className="video-more__head">
        <h2 className="video-more__title">More</h2>
        <button ref={closeRef} type="button" className="video-more__close" onClick={onClose} aria-label="Close More">
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="video-more__scroll">
        <ProfileRow onNavigate={onNavigate} />

        {REELS_MORE_PANEL.map((section) => (
          <section key={section.key} className="video-more__section" aria-label={section.title}>
            <h3 className="video-more__heading">{section.title}</h3>
            {section.layout === "tiles" ? (
              <ul className="video-more__tiles">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      {target(item, "video-more__tile", (
                        <>
                          <span className="video-more__tile-icon"><Icon size={22} strokeWidth={1.75} aria-hidden /></span>
                          <span className="video-more__tile-label">{item.label}</span>
                        </>
                      ))}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="video-more__card">
                {section.items.map((item) => <li key={item.key}>{row(item)}</li>)}
              </ul>
            )}
          </section>
        ))}

        <ul className="video-more__card" aria-label={REELS_MORE_SETTINGS.label}>
          <li>{row(REELS_MORE_SETTINGS)}</li>
        </ul>

        <p className="video-more__legal">
          <Link href="/terms" onClick={onNavigate}>Terms</Link>
          <span aria-hidden> · </span>
          <Link href="/privacy" onClick={onNavigate}>Privacy</Link>
        </p>
      </div>
    </div>
  );
}

/** Who is signed in, linking to their profile. Nothing until it loads. */
function ProfileRow({ onNavigate }: { onNavigate?: () => void }) {
  const { data: me } = useMyProfile();
  if (!me) return null;
  const name = me.display_name || me.preferred_name || me.username || "Your profile";
  const avatar = me.avatar_media_id ? `/v1/media/${me.avatar_media_id}/serve` : null;
  return (
    <Link href="/profile" className="video-more__profile" onClick={onNavigate}>
      <span className="video-more__avatar" aria-hidden>
        {avatar ? <img src={avatar} alt="" /> : name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="video-more__profile-text">
        <span className="video-more__profile-name">{name}</span>
        {me.username ? <span className="video-more__profile-handle">@{me.username} · View profile</span> : null}
      </span>
      <ChevronRight className="video-more__chevron" size={16} strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
