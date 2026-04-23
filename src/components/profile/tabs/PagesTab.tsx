"use client";

import { FileText } from "lucide-react";

export function PagesTab() {
  return (
    <div className="rounded-[28px] border border-brand-divider bg-[#FCFAF7] px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-secondary text-brand-highlight">
        <FileText className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-brand-text">Pages are unavailable on web</h3>
      <p className="mt-2 text-sm leading-6 text-brand-text/60">
        Business Pages are out of ship-week scope and intentionally hidden until they are backed by a real web contract.
      </p>
    </div>
  );
}
