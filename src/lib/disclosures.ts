/*
  Creator disclosures shown to viewers (founder, 21 Oct: "AI generated means
  we have to show that AI on it"). The upload studio and the Creator Hub set
  them; post-service returns them on every post (`ai_generated`,
  `paid_promotion`, `altered_content`), feed rows included.

  One order everywhere: AI-generated first, then paid promotion, then
  altered content.
*/

export interface Disclosures {
  aiGenerated?: boolean;
  paidPromotion?: boolean;
  alteredContent?: boolean;
}

export type DisclosureKind = "ai" | "paid" | "altered";

export interface DisclosureLabel {
  kind: DisclosureKind;
  label: string;
  /** Longer wording for the tooltip and screen readers. */
  description: string;
}

/** Reads the wire flags; anything but a literal true is "not disclosed". */
export function disclosuresFromWire(row: { ai_generated?: unknown; paid_promotion?: unknown; altered_content?: unknown } | null | undefined): Disclosures {
  return {
    aiGenerated: row?.ai_generated === true,
    paidPromotion: row?.paid_promotion === true,
    alteredContent: row?.altered_content === true,
  };
}

export function disclosureLabels(d: Disclosures | null | undefined): DisclosureLabel[] {
  if (!d) return [];
  const out: DisclosureLabel[] = [];
  if (d.aiGenerated) out.push({ kind: "ai", label: "AI-generated", description: "The creator says this was made with AI tools" });
  if (d.paidPromotion) out.push({ kind: "paid", label: "Paid promotion", description: "The creator says this includes paid promotion" });
  if (d.alteredContent) out.push({ kind: "altered", label: "Altered content", description: "The creator says this shows realistic altered or synthetic content" });
  return out;
}
