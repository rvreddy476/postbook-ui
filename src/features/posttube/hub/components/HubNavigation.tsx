"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUpRight, PanelLeftClose, Tv } from "lucide-react";
import type { VideoNavigationProps } from "@/features/video-shell/VideoShell";
import { HUB_NAV, isHubItemCurrent } from "../hubNav";
import "../hub.css";

/** Uses the shell's existing collapse/drawer behavior, never a second rail. */
export function HubNavigation({ expanded, drawer, id, onNavigate }: VideoNavigationProps) {
  const pathname = usePathname();
  return <nav id={id} className={`hub-nav ${expanded ? "is-expanded" : "is-compact"}`} aria-label="Creator Hub">
    <div className="hub-nav-brand">
      <span className="hub-nav-mark"><Tv aria-hidden="true" /></span>
      {expanded ? <div><strong>Creator Hub</strong><span>PostTube workspace</span></div> : null}
      {drawer ? <button className="hub-nav-close" type="button" onClick={onNavigate} aria-label="Close creator navigation"><PanelLeftClose aria-hidden="true" /></button> : null}
    </div>
    <div className="hub-nav-links">
      {expanded ? <p className="hub-nav-label">Workspace</p> : null}
      <ul>
        {HUB_NAV.map((item, i) => {
          const Icon = item.icon;
          return <li key={item.key} className={i === HUB_NAV.length - 2 ? "hub-nav-settings" : undefined}>
            <Link href={item.href} onClick={onNavigate} aria-label={item.label} title={!expanded ? item.label : undefined} aria-current={!item.external && isHubItemCurrent(item, pathname) ? "page" : undefined}>
              <Icon aria-hidden="true" /><span>{item.label}</span>
              {item.external && expanded ? <ArrowUpRight className="hub-nav-external" aria-hidden="true" /> : null}
            </Link>
          </li>;
        })}
      </ul>
    </div>
    <Link href="/posttube" onClick={onNavigate} className="hub-nav-back" title="Back to PostTube"><ArrowLeft aria-hidden="true" />{expanded ? <span>Back to PostTube</span> : null}</Link>
  </nav>;
}
