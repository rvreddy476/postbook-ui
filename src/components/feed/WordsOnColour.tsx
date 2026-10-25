import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import RichTextRenderer from "@/components/studio/RichTextRenderer";
import { scrimFor, type PostRichText } from "@/components/studio/postStyle";

/*
  A few words on a colour: a text post drawn the way its author styled it.

  Lifted out of PostCard so the feed card and the full-screen stage draw
  the same thing. The background, text colour, alignment, size and an
  uploaded background image all come from the post's own rich_text (the
  composer stores literal values there on purpose, so a post looks the same
  to every reader in either theme). When a value is missing the fallback is
  the stage's own token pair, never a literal colour.

  "card" is PostCard's inset rounded box; "stage" fills the frame, centres
  the words and sets them large.
*/

const STAGE_GROUND = "rgb(var(--reel-stage))";
const ON_STAGE = "rgb(var(--reel-on-stage))";

/** The post text with #tags and @mentions as links, coloured for the ground they sit on. */
export function linkifyPostText(body: string, linkClassName: string, linkStyle?: CSSProperties): ReactNode[] {
  // A handle may hold dots (@call.b); a dot that ends a sentence is not part of it.
  return body.split(/(#[\p{L}\p{M}\p{N}_]+|@\w+(?:\.\w+)*)/gu).map((part, i) => {
    if (part.startsWith("#") && part.length > 1) {
      return (
        <Link key={i} href={`/hashtag/${part.slice(1)}`} className={linkClassName} style={linkStyle}>
          {part}
        </Link>
      );
    }
    if (part.startsWith("@") && part.length > 1) {
      return (
        <Link key={i} href={`/u/${part.slice(1)}`} className={linkClassName} style={linkStyle}>
          {part}
        </Link>
      );
    }
    return part;
  });
}

export interface WordsOnColourProps {
  text: string;
  rich: PostRichText | null | undefined;
  variant?: "card" | "stage";
  /** Drawn under the words (the stage puts a poll here). */
  children?: ReactNode;
}

export function WordsOnColour({ text, rich, variant = "card", children }: WordsOnColourProps) {
  const stage = variant === "stage";
  const bg = rich?.background;
  const bgImage = rich?.background_media_id;
  const textColor = rich?.text_color || ON_STAGE;
  const align = rich?.align ?? "center";
  const valign = stage ? "middle" : rich?.valign ?? "middle";
  const scale = Math.min(Math.max(rich?.scale ?? 1, 1), 2);
  const richDoc = rich?.format === "tiptap" ? rich.doc : undefined;
  const heading = typeof rich?.title === "string" ? rich.title.trim() : "";

  const ground: CSSProperties = {
    background: bg || STAGE_GROUND,
    backgroundImage: bgImage ? `url(/v1/media/${bgImage}/serve)` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  const scrim = bgImage ? <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: scrimFor(rich?.text_color) }} /> : null;
  const alignClass = align === "center" ? "text-center" : "text-left";

  if (stage) {
    return (
      <div className="ps-words" style={{ ...ground, color: textColor, ["--ps-words-scale" as string]: String(scale) }} data-align={align}>
        {scrim}
        <div className="ps-words__body">
          {heading ? <h2 className="ps-words__heading">{heading}</h2> : null}
          {richDoc ? (
            <RichTextRenderer doc={richDoc} className={`font-semibold ${alignClass}`} />
          ) : (
            <p className={`ps-words__text ${alignClass}`}>{linkifyPostText(text, "underline underline-offset-2", { color: textColor })}</p>
          )}
          {children}
        </div>
      </div>
    );
  }

  if (richDoc) {
    return (
      <div
        className={`relative mx-3 mb-3 overflow-hidden rounded-xl p-6 sm:mx-4 ${valign === "middle" ? "flex min-h-[200px] flex-col justify-center" : "min-h-[160px]"}`}
        style={{ ...ground, color: textColor, fontSize: `${scale}em` }}
      >
        {scrim}
        <div className="relative">
          {heading && <h2 className="mb-2 text-[1.15em] font-bold">{heading}</h2>}
          <RichTextRenderer doc={richDoc} className={`font-semibold ${alignClass}`} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative mx-3 mb-3 overflow-hidden rounded-xl p-6 sm:mx-4 ${valign === "middle" ? "flex min-h-[160px] flex-col justify-center" : "min-h-[160px]"}`}
      style={ground}
    >
      {scrim}
      <div className="relative">
        <p className={`leading-relaxed whitespace-pre-wrap font-semibold ${alignClass}`} style={{ color: textColor, fontSize: `${scale * 1.25}rem` }}>
          {linkifyPostText(text, "underline underline-offset-2", { color: textColor })}
        </p>
      </div>
    </div>
  );
}
