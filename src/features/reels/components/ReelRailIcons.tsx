import type { SVGProps } from "react";

/*
  The rail's glyphs: solid silhouettes, not strokes, drawn on a 48-unit
  grid the way TikTok's are (a heart, a speech bubble with three dots, a
  bookmark, a curved share arrow, a bold plus). Solid shapes read smaller
  and heavier than outline icons at the same box, which is why the rail
  looked "too big" with stroked icons. Sizes are the ones measured on
  TikTok's rail: heart and bookmark 21px, bubble and arrow 24px, plus 14px,
  each centred in its 48px circle. Our own paths; only the proportions are
  borrowed.
*/

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: IconProps) {
  const { size: _s, ...rest } = props;
  return { width: size, height: size, viewBox: "0 0 48 48", fill: "currentColor", "aria-hidden": true, focusable: false, ...rest } as const;
}

/** A full heart. */
export function RailHeart({ size = 21, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M24 42.5 21.7 41C10.6 33.4 4 26.4 4 17.8 4 11.3 9 6.5 15.2 6.5c3.6 0 7 1.7 8.8 4.4 1.8-2.7 5.2-4.4 8.8-4.4C39 6.5 44 11.3 44 17.8c0 8.6-6.6 15.6-17.7 23.2L24 42.5Z" />
    </svg>
  );
}

/** A speech bubble with three punched dots. */
export function RailBubble({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path
        fillRule="evenodd"
        d="M24 4C11.85 4 2 12.06 2 22c0 5.9 3.5 11.1 8.9 14.4L9 44l10.6-5.3c1.4.2 2.9.3 4.4.3 12.15 0 22-8.06 22-18S36.15 4 24 4Zm-9 21a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm9 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm9 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"
      />
    </svg>
  );
}

/** A bookmark ribbon. */
export function RailBookmark({ size = 21, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 4h24a4 4 0 0 1 4 4v34.2a1.8 1.8 0 0 1-2.9 1.4L24 33.4 10.9 43.6A1.8 1.8 0 0 1 8 42.2V8a4 4 0 0 1 4-4Z" />
    </svg>
  );
}

/** A curved forward arrow. */
export function RailShare({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M27 6.6a2 2 0 0 0-3.4-1.4L23 6v9.3C10.3 16.7 2 26.2 2 38.2a2 2 0 0 0 3.5 1.3c4-4.6 10.2-6.9 17.5-7.1v9.2a2 2 0 0 0 3.4 1.4l19-18.4a2 2 0 0 0 0-2.9L27 6.6Z" />
    </svg>
  );
}

/** The follow badge's plus. */
export function RailPlus({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M21 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v16h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H27v16a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V27H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h16V5Z" />
    </svg>
  );
}
