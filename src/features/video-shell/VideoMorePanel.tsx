"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { logoutUser } from "@/services/authService";
import { REELS_MORE_PANEL, type MorePanelItem } from "./nav";
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

/*
  The More panel: what the last nav entry opens, in the same column, in
  place of the nav list. Four sections as data (nav.ts): links are links;
  Explore opens the launcher; the Dark-mode row carries a three-state
  segmented control (auto / dark / light) that writes the same key the root
  layout's inline script reads and applies the theme at once; Log out runs
  exactly the flow the account menu does.
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

  const renderItem = (item: MorePanelItem) => {
    const Icon = item.icon;
    const inner = (
      <>
        <Icon className="video-nav__icon" size={20} strokeWidth={1.75} aria-hidden />
        <span className="video-nav__label">{item.label}</span>
      </>
    );
    if (item.action === "theme") {
      return (
        <li key={item.key}>
          <ThemeRow label={item.label} icon={<Icon className="video-nav__icon" size={20} strokeWidth={1.75} aria-hidden />} />
        </li>
      );
    }
    if (item.action === "explore") {
      return (
        <li key={item.key}>
          <button type="button" className="video-nav__item" onClick={() => { onNavigate?.(); openExplore(); }} aria-haspopup="dialog">
            {inner}
          </button>
        </li>
      );
    }
    if (item.action === "logout") {
      return (
        <li key={item.key}>
          <button type="button" className="video-nav__item video-more__logout" onClick={logout}>
            {inner}
          </button>
        </li>
      );
    }
    return (
      <li key={item.key}>
        <Link href={item.href ?? "/"} className="video-nav__item" onClick={onNavigate}>
          {inner}
        </Link>
      </li>
    );
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
        {REELS_MORE_PANEL.map((section) => (
          <section key={section.key} className="video-nav__section" aria-label={section.title}>
            <h3 className="video-nav__heading">{section.title}</h3>
            <ul className="video-nav__list">{section.items.map(renderItem)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/*
  The theme row. The current choice is read from storage once the row is
  on the client (the panel never renders on the server — it opens on a
  click — but the read stays in an effect so nothing depends on that).
  While the choice is "auto" the row follows the OS for as long as it is
  mounted; the root layout's script decides on the next load.
*/
function ThemeRow({ label, icon }: { label: string; icon: React.ReactNode }) {
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
    <div className="video-more__theme">
      <div className="video-more__theme-label">
        {icon}
        <span className="video-nav__label">{label}</span>
      </div>
      <div className="video-more__segmented" role="radiogroup" aria-label={label}>
        {THEME_CHOICES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            className="video-more__segment"
            onClick={() => pick(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
