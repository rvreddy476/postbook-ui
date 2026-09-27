"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { HUB_NAV, isHubItemCurrent } from "../hubNav";
import "../hub.css";

/**
  The Creator Hub console: the section rail on the left, the page on the
  right. It sits inside the PostTube layout's VideoShell (app/posttube/
  layout.tsx wraps every route), so there is no second header here.
*/
export function HubFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="hub">
      <nav className="hub-rail" aria-label="Creator Hub">
        {HUB_NAV.map((item, i) => {
          const Icon = item.icon;
          const current = !item.external && isHubItemCurrent(item, pathname);
          return (
            <span key={item.key} style={{ display: "contents" }}>
              {i === HUB_NAV.length - 2 ? <span className="hub-rail-sep" aria-hidden="true" /> : null}
              <Link href={item.href} className="hub-rail-item" aria-current={current ? "page" : undefined} title={item.label}>
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </span>
          );
        })}
      </nav>
      <main className="hub-main">{children}</main>
    </div>
  );
}

export function HubHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="hub-head">
      <div>
        <h1 className="hub-title">{title}</h1>
        {sub ? <p className="hub-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="hub-row hub-row-wrap">{actions}</div> : null}
    </div>
  );
}
