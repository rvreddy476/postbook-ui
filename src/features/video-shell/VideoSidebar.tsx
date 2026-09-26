"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, PanelLeft, Search } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { REELS_SIDEBAR_COPYRIGHT, isNavItemCurrent, videoNav, type VideoApp, type VideoChrome, type VideoNavItem } from "./nav";
import { useChannelSubscriptionsList } from "./useChannelSubscriptionsList";
import { useVideoShell } from "./useVideoShell";
import { VideoMorePanel } from "./VideoMorePanel";

interface VideoSidebarProps {
  app: VideoApp;
  /** Which frame the shell draws; decides what sits above the list (see VideoShell). */
  chrome?: VideoChrome;
  /** Expanded (labels, sections, subscriptions, footer) or the icon rail. */
  expanded: boolean;
  /** The drawer variant: the same expanded menu, laid over the page. */
  drawer?: boolean;
  id?: string;
  onNavigate?: () => void;
}

/*
  The left menu. Two densities from one list: expanded is icon + label
  with section headings; the rail is icons only for the rail groups —
  what a viewer reaches for most, in the width a video page can spare.
  Subscriptions and the footer exist only when there is room to read them.

  Under the "sidebar" chrome the menu is TikTok's, to the pixel
  (REELS_SIDEBAR_METRICS in nav.ts, video-shell.css): the product badge
  and the collapse toggle on one row, the search pill (a lone Search icon
  in the rail, which expands the menu), the list in 40px rows, the footer
  pinned at the bottom. The last entry, More, opens the More panel as a
  320px panel BESIDE the 72px icon rail (the column grows to 392) — in the
  phone drawer, where there is no room for both, it replaces the list.

  The query string decides between For You and Following on the reels
  menu. useSearchParams needs a Suspense boundary for static rendering, so
  the search-aware menu renders inside one, with the same menu (no search)
  as the fallback — the shell never waits on it.
*/
export function VideoSidebar(props: VideoSidebarProps) {
  return (
    <Suspense fallback={<SidebarBody {...props} search={null} />}>
      <SearchAwareSidebar {...props} />
    </Suspense>
  );
}

function SearchAwareSidebar(props: VideoSidebarProps) {
  const params = useSearchParams();
  return <SidebarBody {...props} search={params?.toString() ?? null} />;
}

function SidebarBody({ app, chrome = "header", expanded, drawer = false, id, onNavigate, search }: VideoSidebarProps & { search: string | null }) {
  const pathname = usePathname();
  const { openExplore, openMore, closeMore, panel } = useVideoShell();
  const sections = videoNav(app, chrome);
  const subscriptions = useChannelSubscriptionsList(12);
  // Subscriptions are PostTube's; the reels menu under the sidebar chrome stays TikTok's list.
  const subs = chrome === "sidebar" ? [] : (subscriptions.data?.items ?? []);
  const tiktok = chrome === "sidebar";
  const showMore = tiktok && expanded && panel === "more";
  // Beside the icon rail in a column; in place of the list in the drawer.
  const moreBeside = showMore && !drawer;
  const listExpanded = expanded && !moreBeside;

  const renderItem = (item: VideoNavItem) => {
    const Icon = item.icon;
    const current = item.active || isNavItemCurrent(item, pathname, search) || (item.action === "more" && panel === "more");
    const cls = `video-nav__item${current ? " is-current" : ""}`;
    const inner = (
      <>
        <Icon className="video-nav__icon" size={tiktok ? 24 : listExpanded ? 20 : 22} strokeWidth={current ? 2.25 : 1.75} aria-hidden />
        <span className="video-nav__label">{item.label}</span>
      </>
    );
    if (item.action === "explore") {
      return (
        <li key={item.key}>
          <button type="button" className={cls} onClick={() => { onNavigate?.(); openExplore(); }} aria-haspopup="dialog">
            {inner}
          </button>
        </li>
      );
    }
    if (item.action === "more") {
      return (
        <li key={item.key}>
          <button type="button" className={cls} onClick={panel === "more" ? closeMore : openMore} aria-expanded={panel === "more"}>
            {inner}
          </button>
        </li>
      );
    }
    return (
      <li key={item.key}>
        <Link href={item.href ?? "/"} className={cls} aria-current={current ? "page" : undefined} onClick={onNavigate}>
          {inner}
        </Link>
      </li>
    );
  };

  const list = (
    <>
      {tiktok ? <SidebarSearch expanded={listExpanded} onNavigate={onNavigate} /> : null}

      <div className="video-nav__scroll">
        {sections
          .filter((section) => listExpanded || section.rail)
          .map((section) => {
            if (section.key === "footer") return null;
            return (
              <section key={section.key} className="video-nav__section" aria-label={section.title ?? (section.key === "apps" ? "More apps" : "Apps")}>
                {section.title && listExpanded ? <h3 className="video-nav__heading">{section.title}</h3> : null}
                <ul className="video-nav__list">{section.items.map(renderItem)}</ul>
              </section>
            );
          })}

        {listExpanded && subs.length > 0 ? (
          <section className="video-nav__section" aria-label="Subscriptions">
            <h3 className="video-nav__heading">Subscriptions</h3>
            <ul className="video-nav__list">
              {subs.map(({ channel }) => {
                const href = `/posttube/channel/${encodeURIComponent(channel.handle)}`;
                const current = isNavItemCurrent({ href }, pathname);
                return (
                  <li key={channel.user_id || channel.handle}>
                    <Link href={href} className={`video-nav__item video-nav__channel${current ? " is-current" : ""}`} aria-current={current ? "page" : undefined} onClick={onNavigate}>
                      <Avatar src={channel.avatar_url || undefined} name={channel.name || channel.handle} className="video-nav__avatar" />
                      <span className="video-nav__label">{channel.name || `@${channel.handle}`}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link href="/posttube/subscriptions" className="video-nav__item video-nav__more" onClick={onNavigate}>
                  <ChevronRight className="video-nav__icon" size={20} strokeWidth={1.75} aria-hidden />
                  <span className="video-nav__label">Show more</span>
                </Link>
              </li>
            </ul>
          </section>
        ) : null}
      </div>

      {listExpanded ? (
        <footer className="video-nav__footer">
          <ul className="video-nav__footer-links">
            {sections.find((s) => s.key === "footer")?.items.map((item) => (
              <li key={item.key}>
                <Link href={item.href ?? "/"} onClick={onNavigate}>{item.label}</Link>
              </li>
            ))}
          </ul>
          <p className="video-nav__copyright">{tiktok ? REELS_SIDEBAR_COPYRIGHT : "© VChat"}</p>
        </footer>
      ) : null}
    </>
  );

  return (
    <nav
      id={id}
      className={`video-nav${listExpanded ? " is-expanded" : " is-rail"}${drawer ? " is-drawer" : ""}${moreBeside ? " is-more" : ""}`}
      aria-label={app === "reels" ? "Reels navigation" : "PostTube navigation"}
      data-video-app={app}
      data-chrome={chrome}
    >
      {moreBeside ? (
        <>
          <div className="video-nav__column">
            <SidebarTop />
            {list}
          </div>
          <VideoMorePanel onClose={closeMore} onNavigate={onNavigate} />
        </>
      ) : showMore ? (
        <>
          <SidebarTop />
          <VideoMorePanel onClose={closeMore} onNavigate={onNavigate} />
        </>
      ) : (
        <>
          {tiktok ? <SidebarTop /> : null}
          {list}
        </>
      )}
    </nav>
  );
}

/** The top row of the sidebar chrome: the product badge (home) and the collapse toggle. */
function SidebarTop() {
  const { toggleSidebar, sidebarOpen } = useVideoShell();
  return (
    <div className="video-nav__top">
      <Link href="/" aria-label="VChat home" className="video-nav__brand">
        VC
      </Link>
      <button
        type="button"
        className="video-nav__toggle"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Collapse menu" : "Expand menu"}
        aria-expanded={sidebarOpen}
        aria-controls="video-shell-sidebar"
      >
        <PanelLeft size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/*
  Search at the top of the menu. Submit goes to /search?q= (or /search
  alone when empty), the same as the header's field. In the rail it is a
  lone Search icon: pressing it expands the menu and puts the caret in the
  field once it exists.
*/
function SidebarSearch({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const { toggleSidebar, closeMore, sidebarOpen } = useVideoShell();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const focusOnExpand = useRef(false);

  useEffect(() => {
    if (!expanded || !focusOnExpand.current) return;
    focusOnExpand.current = false;
    inputRef.current?.focus();
  }, [expanded]);

  if (!expanded) {
    return (
      <button
        type="button"
        className="video-nav__search-button"
        aria-label="Search"
        onClick={() => {
          focusOnExpand.current = true;
          // Beside the More panel the column is already open: closing the panel brings the field back.
          if (sidebarOpen) closeMore();
          else toggleSidebar();
        }}
      >
        <Search size={22} strokeWidth={1.75} aria-hidden />
      </button>
    );
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = value.trim();
    onNavigate?.();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    else router.push("/search");
  };

  return (
    <form role="search" className="video-nav__search" onSubmit={onSubmit}>
      <Search className="video-nav__search-icon" size={20} strokeWidth={1.75} aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search"
        aria-label="Search"
        autoComplete="off"
      />
    </form>
  );
}
