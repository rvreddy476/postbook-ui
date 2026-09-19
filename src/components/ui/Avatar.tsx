'use client';

import React, { useState } from 'react';

interface AvatarProps {
  /** Image address; when absent or failing to load, the initial is shown. */
  src?: string | null;
  /** Used for the initial fallback. Not rendered as alt text. */
  name: string;
  /** Size and any extras, e.g. "h-10 w-10". */
  className?: string;
}

/**
 * A round avatar that never shows a broken image.
 *
 * A present address is not a working one: without onError a 404 renders the
 * browser's broken-image icon, or the alt text, inside the circle. This falls
 * back to the person's initial on a neutral fill — the same treatment the chat
 * list uses — so a missing photo looks intentional.
 *
 * alt is empty on purpose: the name always sits beside an avatar, so alt text
 * would be read twice by a screen reader and would be the thing that renders
 * when the image fails.
 */
export default function Avatar({ src, name, className = 'h-10 w-10' }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-full bg-brand-secondary ${className}`}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-brand-text/55">
          {initial}
        </span>
      )}
    </span>
  );
}
