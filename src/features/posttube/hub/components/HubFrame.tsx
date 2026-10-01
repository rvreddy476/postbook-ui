"use client";

import type { ReactNode } from "react";

import "../hub.css";

/**
  The shell owns the Creator Hub navigation and the only main landmark.
  Keep page content here so the Hub never stacks a second rail or header.
*/
export function HubFrame({ children }: { children: ReactNode }) {
  return (
    <div className="hub">
      <div className="hub-main">{children}</div>
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
