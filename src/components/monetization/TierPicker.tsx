"use client";

import React from "react";
import { useCreatorTiers, useSubscribe } from "@/hooks/useMonetization";

interface TierPickerProps {
  creatorId: string;
  creatorName?: string;
  open: boolean;
  onClose: () => void;
  onSubscribed?: (tierId: string) => void;
}

// Fan-side tier selection. Lists the creator's active tiers and
// subscribes on click. SubscribeButton is the lower-level component
// for the case when the tier is already known; this is the picker
// for "Become a member" CTA on a profile page.
const TierPicker: React.FC<TierPickerProps> = ({
  creatorId,
  creatorName,
  open,
  onClose,
  onSubscribed,
}) => {
  const { data: tiers, isLoading, error } = useCreatorTiers(open ? creatorId : null);
  const subscribe = useSubscribe();
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  if (!open) return null;

  const handlePick = (tierId: string) => {
    setErrMsg(null);
    subscribe.mutate(
      { creatorId, tier_id: tierId },
      {
        onSuccess: () => {
          onSubscribed?.(tierId);
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { error?: { message?: string } } } };
          setErrMsg(e.response?.data?.error?.message ?? "Failed to subscribe");
        },
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Become a member</h2>
            <p className="text-sm text-zinc-500 mt-1">
              {creatorName ? `Support ${creatorName} and unlock members-only content` : "Pick a tier"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        {isLoading && (
          <div className="py-8 text-center text-zinc-500">Loading tiers…</div>
        )}

        {error && (
          <div className="py-6 text-center text-red-600 dark:text-red-400">
            Couldn&apos;t load tiers. Please try again.
          </div>
        )}

        {tiers && tiers.length === 0 && (
          <div className="py-8 text-center text-zinc-500">
            This creator hasn&apos;t set up any membership tiers yet.
          </div>
        )}

        <div className="space-y-3">
          {tiers?.map((t) => (
            <div
              key={t.id}
              className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 hover:border-violet-400 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-zinc-500">
                    ₹{t.price.toFixed(2)} / month
                  </div>
                  {t.perks.length > 0 && (
                    <ul className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 list-disc list-inside">
                      {t.perks.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  disabled={subscribe.isPending}
                  onClick={() => handlePick(t.id)}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  {subscribe.isPending ? "..." : "Join"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {errMsg && (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">{errMsg}</div>
        )}
      </div>
    </div>
  );
};

export default TierPicker;
