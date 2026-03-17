"use client";

import { useState } from "react";
import { AlertTriangle, BadgeCheck, Download, Trash2 } from "lucide-react";

export function AdvancedTab() {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Channel Verification */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <BadgeCheck className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-brand-text">Channel Verification</h2>
            <p className="text-[11px] text-brand-text/60">Verified channels get a badge and priority in search</p>
          </div>
        </div>
        <div className="rounded-xl bg-brand-secondary p-4">
          <p className="text-[12px] font-medium text-brand-highlight">Status: Not Verified</p>
          <p className="mt-1 text-[11px] text-brand-text/60">
            Verification is currently available by invitation only. Continue growing your
            channel to become eligible.
          </p>
        </div>
      </div>

      {/* Export Data */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <Download className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-brand-text">Export Channel Data</h2>
            <p className="text-[11px] text-brand-text/60">Download all your channel data including videos, analytics, and settings</p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl bg-slate-100 px-4 py-2.5 text-[12px] font-semibold text-brand-highlight transition-colors hover:bg-slate-200"
        >
          Request Export
        </button>
      </div>

      {/* Delete Channel */}
      <div className="rounded-2xl border border-rose-200/60 bg-brand-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
            <Trash2 className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-rose-700">Delete Channel</h2>
            <p className="text-[11px] text-brand-text/60">Permanently remove this channel and all its content</p>
          </div>
        </div>

        {!deleteConfirmOpen ? (
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="rounded-xl bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-600 transition-colors hover:bg-rose-100"
          >
            Delete Channel
          </button>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <div>
                <p className="text-[12px] font-bold text-rose-800">Are you sure?</p>
                <p className="mt-1 text-[11px] leading-relaxed text-rose-600">
                  This action is permanent and cannot be undone. All videos, subscribers,
                  and analytics will be permanently deleted. Your handle will become available
                  for others after 30 days.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    className="rounded-lg bg-brand-card px-3 py-1.5 text-[12px] font-semibold text-brand-highlight shadow-sm hover:bg-brand-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-rose-700"
                  >
                    Permanently Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
