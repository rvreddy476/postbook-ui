/*
  Publish defaults (Creator Hub → Preferences).

  Stored in localStorage under `posttube_publish_defaults_v1` as JSON:
    {
      "visibility": "public" | "unlisted" | "private",
      "topic": "<category slug>" | "",
      "license": "standard" | "cc-by",
      "comments": true | false,          // false = new videos start with no_comments
      "language": "<bcp47>" | ""
    }

  Read it from the upload studio with:
    import { getPublishDefaults } from "@/features/posttube/hub/publishDefaults";
    const d = getPublishDefaults();      // always a full object, never null
  Every missing or malformed key falls back to PUBLISH_DEFAULTS, so a
  reader never branches on undefined. `subscribePublishDefaults` fires on
  a change in this tab or another (a `storage` event), for a studio that
  is already open.
*/

export const PUBLISH_DEFAULTS_KEY = "posttube_publish_defaults_v1";
export const PUBLISH_DEFAULTS_EVENT = "posttube:publish-defaults";

export type PublishVisibility = "public" | "unlisted" | "private";
export type PublishLicense = "standard" | "cc-by";

export interface PublishDefaults {
  visibility: PublishVisibility;
  /** Category slug from `GET /v1/posts/categories`, or "" for none. */
  topic: string;
  license: PublishLicense;
  comments: boolean;
  /** BCP 47 tag ("en", "hi", "te"), or "" for "not set". */
  language: string;
}

export const PUBLISH_DEFAULTS: PublishDefaults = {
  visibility: "public",
  topic: "",
  license: "standard",
  comments: true,
  language: "",
};

export const PUBLISH_LICENSES: { id: PublishLicense; label: string; hint: string }[] = [
  { id: "standard", label: "Standard", hint: "Viewers watch here; no reuse rights are granted." },
  { id: "cc-by", label: "Creative Commons BY", hint: "Others may reuse it with credit." },
];

/** Parses whatever is in storage; malformed input yields the defaults. */
export function parsePublishDefaults(raw: string | null | undefined): PublishDefaults {
  if (!raw) return { ...PUBLISH_DEFAULTS };
  try {
    const obj = JSON.parse(raw) as Partial<PublishDefaults> | null;
    if (!obj || typeof obj !== "object") return { ...PUBLISH_DEFAULTS };
    return {
      visibility: obj.visibility === "unlisted" || obj.visibility === "private" || obj.visibility === "public" ? obj.visibility : PUBLISH_DEFAULTS.visibility,
      topic: typeof obj.topic === "string" ? obj.topic.trim() : PUBLISH_DEFAULTS.topic,
      license: obj.license === "cc-by" || obj.license === "standard" ? obj.license : PUBLISH_DEFAULTS.license,
      comments: typeof obj.comments === "boolean" ? obj.comments : PUBLISH_DEFAULTS.comments,
      language: typeof obj.language === "string" ? obj.language.trim() : PUBLISH_DEFAULTS.language,
    };
  } catch {
    return { ...PUBLISH_DEFAULTS };
  }
}

export function serializePublishDefaults(d: PublishDefaults): string {
  return JSON.stringify(parsePublishDefaults(JSON.stringify(d)));
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The one read the upload studio needs. Safe on the server (returns the defaults). */
export function getPublishDefaults(): PublishDefaults {
  const s = storage();
  if (!s) return { ...PUBLISH_DEFAULTS };
  try {
    return parsePublishDefaults(s.getItem(PUBLISH_DEFAULTS_KEY));
  } catch {
    return { ...PUBLISH_DEFAULTS };
  }
}

export function setPublishDefaults(next: Partial<PublishDefaults>): PublishDefaults {
  const merged = parsePublishDefaults(JSON.stringify({ ...getPublishDefaults(), ...next }));
  const s = storage();
  if (s) {
    try {
      s.setItem(PUBLISH_DEFAULTS_KEY, JSON.stringify(merged));
    } catch {
      /* private mode / quota: the in-memory value still applies for this page */
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PUBLISH_DEFAULTS_EVENT, { detail: merged }));
  return merged;
}

export function resetPublishDefaults(): PublishDefaults {
  const s = storage();
  if (s) {
    try {
      s.removeItem(PUBLISH_DEFAULTS_KEY);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PUBLISH_DEFAULTS_EVENT, { detail: { ...PUBLISH_DEFAULTS } }));
  return { ...PUBLISH_DEFAULTS };
}

/** Change notifications for a mounted studio; returns the unsubscribe. */
export function subscribePublishDefaults(listener: (d: PublishDefaults) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => listener(getPublishDefaults());
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PUBLISH_DEFAULTS_KEY) listener(getPublishDefaults());
  };
  window.addEventListener(PUBLISH_DEFAULTS_EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PUBLISH_DEFAULTS_EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

/** Languages offered in the pickers; the value is what `language` stores. */
export const PUBLISH_LANGUAGES: { code: string; label: string }[] = [
  { code: "", label: "Not set" },
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "mr", label: "Marathi" },
  { code: "bn", label: "Bengali" },
  { code: "gu", label: "Gujarati" },
  { code: "pa", label: "Punjabi" },
  { code: "ur", label: "Urdu" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
];
