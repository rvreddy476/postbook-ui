/*
  The few places a raw pixel font size is allowed to stay, each with the
  reason. src/ui/__tests__/typeScale.test.ts fails on any other raw size in
  the folders it guards; add a row here only when the size genuinely is
  not type on the page (SVG user units, print, a measurement), never to
  skip the scale.
*/
export interface TypeScaleException {
  /** Path from the repo root, forward slashes. */
  file: string;
  /** The exact declaration or class that is allowed, e.g. "font-size: 5.4px". */
  match: string;
  reason: string;
}

export const TYPE_SCALE_ALLOWLIST: readonly TypeScaleException[] = [
  {
    file: "src/features/reels/components/reels-screen.css",
    match: "font-size: 5.4px",
    reason:
      "The word inside the Follow seal is SVG <text> sized in the seal's own viewBox units and scaled with it; it is artwork, not page type.",
  },
];
