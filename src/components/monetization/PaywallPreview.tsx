"use client";

import React, { useState } from "react";
import TierPicker from "./TierPicker";

interface PaywallPreviewProps {
  creatorId: string;
  creatorName?: string;
  tierRequiredId?: string | null;
}

// Rendered in place of a post's body when the response had
// `body_redacted: true`. The minimum-viable version: lock icon,
// "Members only" label, and a "Become a member" button that opens the
// tier picker. Title, cover, and counts are still visible because the
// backend doesn't redact them.
const PaywallPreview: React.FC<PaywallPreviewProps> = ({
  creatorId,
  creatorName,
  tierRequiredId,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="my-4">
      <div className="rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/30 p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center mb-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6 text-violet-600 dark:text-violet-300"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          Members-only content
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {creatorName
            ? `Become a member to unlock ${creatorName}'s premium posts.`
            : "Become a member to unlock premium posts from this creator."}
        </p>
        <button
          onClick={() => setShowPicker(true)}
          className="mt-4 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium"
        >
          Become a member
        </button>
        {tierRequiredId && (
          <p className="mt-2 text-xs text-zinc-500">
            Or upgrade your existing membership tier.
          </p>
        )}
      </div>
      <TierPicker
        creatorId={creatorId}
        creatorName={creatorName}
        open={showPicker}
        onClose={() => setShowPicker(false)}
      />
    </div>
  );
};

export default PaywallPreview;
