import type { VideoCategory, VideoCategoryKind } from "@/features/posttube/model";
import type { ContentType } from "./tokens";

/*
  The studio's topic select, fed by GET /v1/posts/categories — the one
  taxonomy every video surface reads (the home strip, search, the catalog).
  The old hardcoded YouTube-style list is gone: the studio wrote names the
  chips could never match. The select stores the SLUG and shows the label.

  Two API shapes are accepted (normalizeCategories does the parsing): the
  merged `{slug,label,kind}` list, where `kind` says which studio an entry
  is for, and the current flick-only `{id,label}` list, which has no kind
  and is offered to every studio as is.
*/

export interface CategoryOption {
  /** The slug the draft stores and the API validates. */
  value: string;
  label: string;
}

/** Which taxonomy kinds a studio may pick from; "all" is always in. */
export function categoryKindsFor(contentType: ContentType): readonly VideoCategoryKind[] {
  return contentType === "reel" || contentType === "short" ? ["all", "short"] : ["all", "long"];
}

/** The label for a stored value; a slug the list does not know is shown as typed (an old draft). */
export function categoryLabel(categories: readonly VideoCategory[] | null | undefined, value: string): string {
  const hit = (categories ?? []).find((c) => c.slug === value);
  return hit ? hit.label : value;
}

/**
 * Options for the select: the taxonomy filtered to this studio's kinds, in
 * API order. When the draft already holds a value the list does not offer
 * — a category saved before the taxonomy, or one filtered out — it is kept
 * as a trailing option so the select shows what is stored instead of
 * blanking it; the API is what decides whether it is still accepted.
 */
export function categoryOptions(
  categories: readonly VideoCategory[] | null | undefined,
  contentType: ContentType,
  current?: string | null,
): CategoryOption[] {
  const kinds = categoryKindsFor(contentType);
  const options: CategoryOption[] = [];
  const seen = new Set<string>();
  for (const c of categories ?? []) {
    if (c.kind && !kinds.includes(c.kind)) continue;
    if (!c.slug || seen.has(c.slug)) continue;
    seen.add(c.slug);
    options.push({ value: c.slug, label: c.label || c.slug });
  }
  const stored = (current ?? "").trim();
  if (stored && !seen.has(stored)) {
    options.push({ value: stored, label: categoryLabel(categories, stored) });
  }
  return options;
}
