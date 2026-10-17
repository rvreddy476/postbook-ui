"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Monitor, Moon, Sun, X, type LucideIcon } from "lucide-react";

import { useMyProfile } from "@/hooks/useEditProfile";
import { logoutUser } from "@/services/authService";
import { REELS_MORE_LOGOUT, REELS_MORE_PANEL, REELS_MORE_THEME, type MorePanelItem } from "./nav";
import { THEME_CHOICES, chooseTheme, readThemeChoice, type ThemeChoice } from "./themeChoice";
import { useVideoShell } from "./useVideoShell";

interface VideoMorePanelProps {
  /** ✕ (and Escape, handled by the shell): back to the nav list. */
  onClose: () => void;
  /** A drawer closes itself after a link is followed. */
  onNavigate?: () => void;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Store the choice and apply it to the document at once. Client only. */
function applyThemeChoice(choice: ThemeChoice) {
  chooseTheme(choice, {
    storage: localStorage,
    root: document.documentElement,
    prefersDark: window.matchMedia(DARK_QUERY).matches,
  });
}

const THEME_ICONS: Record<ThemeChoice, LucideIcon> = { auto: Monitor, dark: Moon, light: Sun };
const THEME_WORDS: Record<ThemeChoice, string> = { auto: "System", dark: "Dark", light: "Light" };

/*
  The More panel: what the last nav entry opens, in the same column, in
  place of the nav list (or beside the icon rail). It draws only its own
  video-more__* classes: the rail's rules hide .video-nav__label, and when
  the panel borrowed those classes it showed icons only beside the rail
  (founder's screenshot, 17 Oct).

  Top to bottom: who you are (to your profile), the apps as tiles, the
  grouped lists from nav.ts, the appearance switch (writes the key the root
  layout's inline script reads and applies the theme at once), Log out
  (exactly the account menu's flow) and the legal links.
*/
export function VideoMorePanel({ onClose, onNavigate }: VideoMorePanelProps) {
  const { openExplore } = useVideoShell();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Opened by a click on "More": focus moves into the panel, to its ✕.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const logout = () => {
    logoutUser();
    window.location.assign("/api/auth/logout");
  };

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

  const LogoutIcon = REELS_MORE_LOGOUT.icon;

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
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      {target(item, "video-more__row", (
                        <>
                          <span className="video-more__row-icon"><Icon size={18} strokeWidth={1.75} aria-hidden /></span>
                          <span className="video-more__label">{item.label}</span>
                          <ChevronRight className="video-more__chevron" size={16} strokeWidth={1.75} aria-hidden />
                        </>
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}

        <section className="video-more__section" aria-label={REELS_MORE_THEME.label}>
          <h3 className="video-more__heading">{REELS_MORE_THEME.label}</h3>
          <ThemeSwitch label={REELS_MORE_THEME.label} />
        </section>

        <div className="video-more__section">
          <button type="button" className="video-more__row video-more__logout" onClick={logout}>
            <span className="video-more__row-icon"><LogoutIcon size={18} strokeWidth={1.75} aria-hidden /></span>
            <span className="video-more__label">{REELS_MORE_LOGOUT.label}</span>
          </button>
        </div>

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

/*
  The appearance switch. The current choice is read from storage once the
  panel is on the client (it never renders on the server — it opens on a
  click — but the read stays in an effect so nothing depends on that).
  While the choice is "auto" the page follows the OS for as long as the
  panel is mounted; the root layout's script decides on the next load.
*/
function ThemeSwitch({ label }: { label: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("auto");

  useEffect(() => {
    setChoice(readThemeChoice(localStorage));
  }, []);

  useEffect(() => {
    if (choice !== "auto") return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => applyThemeChoice("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const pick = (next: ThemeChoice) => {
    setChoice(next);
    applyThemeChoice(next);
  };

  return (
    <div className="video-more__segmented" role="radiogroup" aria-label={label}>
      {THEME_CHOICES.map((option) => {
        const Icon = THEME_ICONS[option.value];
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            className="video-more__segment"
            onClick={() => pick(option.value)}
          >
            <Icon size={15} strokeWidth={1.75} aria-hidden />
            <span>{THEME_WORDS[option.value]}</span>
          </button>
        );
      })}
    </div>
  );
}
