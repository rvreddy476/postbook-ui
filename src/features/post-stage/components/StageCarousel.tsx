"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { onImageError, resolveImageUrl } from "@/lib/imageUrl";
import type { StageMedia } from "@/features/post-stage/model";
import { StageVideo } from "@/features/post-stage/components/StageVideo";

/*
  A post's photos (and videos) side by side: swiped sideways on a touch
  screen (a horizontal scroll-snap strip, so the browser does the gesture),
  stepped with the arrow buttons on a desktop, and "n/N" in the top-right.
  Photos are the 1080px rendition (medium_1080; small_480 on data saver),
  falling back to the original once if the rendition is missing.
*/

export function stagePhotoSrc(mediaId: string, dataSaver: boolean): string {
  return resolveImageUrl(`/v1/media/${mediaId}/serve`, { dataSaver, size: "large" });
}

export function StageCarousel({
  media,
  index,
  onIndex,
  active,
  dataSaver,
  poster,
}: {
  media: StageMedia[];
  index: number;
  onIndex: (i: number) => void;
  /** The page is the one on screen (a video slide plays only then). */
  active: boolean;
  dataSaver: boolean;
  poster?: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const many = media.length > 1;

  // Arrows and keys move the strip; a swipe moves the index (onScroll).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !strip.clientWidth) return;
    const left = index * strip.clientWidth;
    if (Math.abs(strip.scrollLeft - left) > 2) strip.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
  }, [index, reduceMotion]);

  const onScroll = () => {
    const strip = stripRef.current;
    if (!strip || !strip.clientWidth) return;
    const i = Math.round(strip.scrollLeft / strip.clientWidth);
    if (i !== index && i >= 0 && i < media.length) onIndex(i);
  };

  return (
    <div className="ps-carousel" aria-roledescription={many ? "carousel" : undefined}>
      <div ref={stripRef} className="ps-carousel__strip" onScroll={many ? onScroll : undefined}>
        {media.map((m, i) => (
          <div
            key={m.mediaId}
            className="ps-carousel__slide"
            aria-roledescription={many ? "slide" : undefined}
            aria-label={many ? `${i + 1} of ${media.length}` : undefined}
            aria-hidden={many && i !== index ? true : undefined}
          >
            {m.kind === "video" ? (
              <StageVideo media={m} active={active && i === index} poster={poster} />
            ) : (
              <img
                className="ps-carousel__img"
                src={stagePhotoSrc(m.mediaId, dataSaver)}
                alt={m.alt}
                onError={onImageError}
                loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
              />
            )}
          </div>
        ))}
      </div>
      {many ? (
        <>
          <span className="ps-carousel__counter" aria-hidden="true">
            {index + 1}/{media.length}
          </span>
          {index > 0 ? (
            <button type="button" className="ps-carousel__arrow is-prev" aria-label="Previous photo" onClick={() => onIndex(index - 1)}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          ) : null}
          {index < media.length - 1 ? (
            <button type="button" className="ps-carousel__arrow is-next" aria-label="Next photo" onClick={() => onIndex(index + 1)}>
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** The dots above the caption: one per item, the current one wider. */
export function CarouselDots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <div className="ps-dots" role="img" aria-label={`Photo ${index + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`ps-dots__dot${i === index ? " is-current" : ""}`} />
      ))}
    </div>
  );
}
