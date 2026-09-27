/*
  Thanks (a tip to the creator) — the pure rules behind the rail button
  and the sheet. Nothing here touches the network; watchApi.ts owns the
  request and the wire shape.
*/

/** What GET /v1/monetization/creators/:creatorId/support answers, normalized. */
export interface CreatorSupport {
  tipsEnabled: boolean;
  /** The smallest tip the server accepts, in paise (≥ 100 after normalization). */
  minTipPaise: number;
  currency: string;
  membershipTiers: { id: string; name: string; price_paise: number }[];
}

export const DEFAULT_MIN_TIP_PAISE = 1000;

export interface ThanksPill {
  /** null = the custom entry. */
  paise: number | null;
  label: string;
}

export const THANKS_MULTIPLIERS = [1, 2, 5] as const;

/** `₹10`, `₹12.50` — whole rupees without the decimals. */
export function formatPaise(paise: number, currency = "INR"): string {
  const rupees = Math.max(0, Math.round(paise)) / 100;
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return Number.isInteger(rupees) ? `${symbol}${rupees}` : `${symbol}${rupees.toFixed(2)}`;
}

/**
 * The amount pills: the server's minimum, 2×, 5× and Custom. A minimum
 * that is missing, zero or negative falls back to DEFAULT_MIN_TIP_PAISE,
 * so the sheet never offers ₹0.
 */
export function thanksAmountPills(minTipPaise: number | null | undefined, currency = "INR"): ThanksPill[] {
  const min = typeof minTipPaise === "number" && Number.isFinite(minTipPaise) && minTipPaise > 0 ? Math.round(minTipPaise) : DEFAULT_MIN_TIP_PAISE;
  const pills: ThanksPill[] = THANKS_MULTIPLIERS.map((m) => ({ paise: min * m, label: formatPaise(min * m, currency) }));
  pills.push({ paise: null, label: "Custom" });
  return pills;
}

/**
 * A typed custom amount ("25", "12.5", "₹ 40") → paise, or null when it is
 * not a number or is under the minimum. Capped at ₹1,00,000 so a stray
 * keystroke never asks the wallet for more than that.
 */
export const MAX_TIP_PAISE = 100_000 * 100;

export function parseCustomAmount(input: string, minTipPaise: number): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const paise = Math.round(parseFloat(cleaned) * 100);
  if (!Number.isFinite(paise) || paise < Math.max(1, minTipPaise) || paise > MAX_TIP_PAISE) return null;
  return paise;
}

/**
 * The rail shows Thanks only when the creator has tips on and the viewer
 * is not the creator. A signed-out viewer still sees it (the click asks
 * them to sign in, like Love); an unknown support read (null) hides it.
 */
export function showThanks(support: CreatorSupport | null | undefined, viewerId: string | null | undefined, authorId: string | null | undefined): boolean {
  if (!support || !support.tipsEnabled) return false;
  if (!authorId) return false;
  if (viewerId && viewerId === authorId) return false;
  return true;
}

/** Reads the support row as the server sends it; anything malformed → tips off. */
export function normalizeSupport(raw: unknown): CreatorSupport {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const min = typeof o.min_tip_paise === "number" && Number.isFinite(o.min_tip_paise) && o.min_tip_paise > 0 ? Math.round(o.min_tip_paise) : DEFAULT_MIN_TIP_PAISE;
  const tiers = Array.isArray(o.membership_tiers) ? o.membership_tiers : [];
  return {
    tipsEnabled: o.tips_enabled === true,
    minTipPaise: min,
    currency: typeof o.currency === "string" && o.currency.trim() ? o.currency.trim().toUpperCase() : "INR",
    membershipTiers: tiers
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({ id: String(t.id ?? ""), name: String(t.name ?? ""), price_paise: typeof t.price_paise === "number" ? t.price_paise : 0 }))
      .filter((t) => t.id),
  };
}
