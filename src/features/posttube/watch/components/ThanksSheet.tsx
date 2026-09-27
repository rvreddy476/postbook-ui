"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { parseCustomAmount, thanksAmountPills, formatPaise, type CreatorSupport } from "../thanks";

/*
  The Thanks sheet: the reels confirm card (reel-confirm-scrim /
  reel-confirm-card — a bottom sheet on phones, a centred card from
  640px) with the amount pills (the server's minimum, 2×, 5×, Custom),
  an optional message and Send. The page owns the request (watchApi
  .sendThanks) and the toasts; this is the form only. Escape and the
  scrim cancel; clicks never reach the stage underneath.
*/

export const THANKS_MESSAGE_MAX = 200;

export interface ThanksSheetProps {
  open: boolean;
  channelName: string;
  support: Pick<CreatorSupport, "minTipPaise" | "currency">;
  pending?: boolean;
  onSend: (input: { amountPaise: number; message: string }) => void;
  onCancel: () => void;
}

export function ThanksSheet({ open, channelName, support, pending = false, onSend, onCancel }: ThanksSheetProps) {
  const pills = useMemo(() => thanksAmountPills(support.minTipPaise, support.currency), [support.minTipPaise, support.currency]);
  const [choice, setChoice] = useState<number>(0);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const firstRef = useRef<HTMLButtonElement>(null);

  // A fresh sheet every time it opens.
  useEffect(() => {
    if (!open) return;
    setChoice(0);
    setCustom("");
    setMessage("");
    const previous = document.activeElement as HTMLElement | null;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const isCustom = pills[choice]?.paise === null;
  const customPaise = isCustom ? parseCustomAmount(custom, support.minTipPaise) : null;
  const amountPaise = isCustom ? customPaise : pills[choice]?.paise ?? null;
  const customInvalid = isCustom && custom.trim() !== "" && customPaise === null;

  return (
    <div
      className="reel-confirm-scrim"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="tube-thanks-title" className="reel-confirm-card" onClick={(e) => e.stopPropagation()} data-sheet="thanks">
        <h2 id="tube-thanks-title" className="text-[15px] font-bold">
          Thank {channelName}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-brand-text/70">A tip goes straight to the creator from your wallet.</p>

        <div className="tube-thanks__pills" role="radiogroup" aria-label="Amount">
          {pills.map((p, i) => (
            <button
              key={p.label}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              role="radio"
              aria-checked={choice === i}
              className="tube-thanks__pill"
              data-amount={p.paise ?? "custom"}
              onClick={() => setChoice(i)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isCustom ? (
          <>
            <input
              className="tube-thanks__field"
              inputMode="decimal"
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={`Amount, at least ${formatPaise(support.minTipPaise, support.currency)}`}
              aria-label="Custom amount"
              aria-invalid={customInvalid}
            />
            {customInvalid ? <p className="tube-thanks__hint is-error">At least {formatPaise(support.minTipPaise, support.currency)}, up to two decimals.</p> : null}
          </>
        ) : null}

        <textarea
          className="tube-thanks__field"
          rows={2}
          maxLength={THANKS_MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a message (optional)"
          aria-label="Message"
        />
        <p className="tube-thanks__hint">
          {message.length}/{THANKS_MESSAGE_MAX}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-[13px] font-semibold text-brand-text transition hover:bg-brand-secondary">
            Cancel
          </button>
          <button
            type="button"
            className="reel-confirm-button"
            disabled={pending || amountPaise === null}
            onClick={() => {
              if (amountPaise !== null) onSend({ amountPaise, message: message.trim() });
            }}
          >
            {pending ? "Sending…" : amountPaise !== null ? `Send ${formatPaise(amountPaise, support.currency)}` : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
