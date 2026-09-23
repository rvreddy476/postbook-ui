'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import RichTextRenderer, { docToPlainText } from '@/components/studio/RichTextRenderer';
import type { RichNode } from '@/components/studio/postStyle';

/**
 * A journal entry, set as an article rather than as a post.
 *
 * A journal entry is the one thing in this feed somebody sat down to WRITE,
 * and it was being rendered with the same type as a one-line status —
 * centred, at 15px, in a card that gives a paragraph the same weight as
 * "Good Morning". Centring is the worst of it: centred text has no straight
 * left edge for the eye to return to, so every line costs the reader a moment
 * to find, which is exactly the cost you cannot pay across paragraphs.
 *
 * So: left-aligned, on a measure that keeps a line near the 65-75 characters
 * prose is comfortable at, with the title given display size and the body an
 * article's leading. The rule down the left marks it as an entry without
 * needing a badge to say so.
 *
 * Long entries collapse. An 800-word piece in a feed pushes everything else
 * off the screen, and a reader scrolling past it has to scroll past ALL of it.
 */

/** Average adult reading speed, words per minute. Rounded up, floor of one. */
const WORDS_PER_MINUTE = 220;

/** Above this many characters the entry is collapsed behind "Read more". */
const COLLAPSE_OVER_CHARS = 900;

export default function JournalBody({
    doc,
    title,
}: {
    doc: RichNode;
    title?: string;
}) {
    const plain = useMemo(() => docToPlainText(doc), [doc]);
    const [expanded, setExpanded] = useState(false);

    const readingMinutes = useMemo(() => {
        const words = plain.split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
    }, [plain]);

    const isLong = plain.length > COLLAPSE_OVER_CHARS;
    const collapsed = isLong && !expanded;

    return (
        <div className="px-3 pb-4 sm:px-4">
            <article
                className={[
                    // The left rule is the whole marker. A coloured "JOURNAL"
                    // pill would announce the format louder than the writing.
                    'relative border-l-2 border-brand-outline pl-4 sm:pl-5',
                    collapsed ? 'max-h-[22rem] overflow-hidden' : '',
                ].join(' ')}
            >
                <header className="mb-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-brand-text/45">
                        <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Journal
                        <span aria-hidden>·</span>
                        <span className="normal-case tracking-normal">
                            {readingMinutes} min read
                        </span>
                    </div>
                    {title && (
                        <h2 className="text-[22px] font-semibold leading-[1.25] -tracking-[0.02em] text-brand-text sm:text-[25px]">
                            {title}
                        </h2>
                    )}
                </header>

                {/*
                  max-w-[62ch] is the measure, not a container width: it holds a
                  line near the length prose is read comfortably at, whatever
                  the column does around it.
                */}
                <div className="max-w-[62ch] text-left text-[16px] leading-[1.7] text-brand-text/85 [&_h2]:text-brand-text [&_h3]:text-brand-text [&_strong]:text-brand-text">
                    <RichTextRenderer doc={doc} />
                </div>

                {collapsed && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-card to-transparent"
                    />
                )}
            </article>

            {isLong && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2 pl-4 text-[13px] font-semibold text-primary-ink transition-colors hover:text-primary-hover sm:pl-5"
                >
                    {expanded ? 'Show less' : 'Read more'}
                </button>
            )}
        </div>
    );
}
