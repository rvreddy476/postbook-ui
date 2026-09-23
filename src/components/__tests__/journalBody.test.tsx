import { describe, it, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import JournalBody, { journalLayout, readingMinutes } from '../JournalBody';
import type { RichNode } from '../studio/postStyle';

const paragraph = (text: string): RichNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const doc = (...paras: string[]): RichNode => ({
  type: 'doc',
  content: paras.map(paragraph),
});

describe('JournalBody', () => {
  it('reads left, never centred', () => {
    // The bug this replaced: a journal entry inherited the styled-card
    // default of centre, so paragraphs of prose had no straight left edge.
    const html = renderToStaticMarkup(
      React.createElement(JournalBody, { doc: doc('A paragraph of prose.'), title: 'T' }),
    );
    expect(html).toContain('text-left');
    expect(html).not.toContain('text-center');
  });

  it('shows a reading time, never zero minutes', () => {
    const html = renderToStaticMarkup(
      React.createElement(JournalBody, { doc: doc('Two words'), title: 'T' }),
    );
    expect(html).toContain('1 min read');
  });

  it('scales the reading time with the writing', () => {
    // 660 words at 220 wpm is 3 minutes.
    const long = doc(Array.from({ length: 660 }, () => 'word').join(' '));
    const html = renderToStaticMarkup(React.createElement(JournalBody, { doc: long }));
    expect(html).toContain('3 min read');
  });

  it('collapses a long entry behind Read more', () => {
    const long = doc('x'.repeat(1200));
    const html = renderToStaticMarkup(React.createElement(JournalBody, { doc: long }));
    expect(html).toContain('Read more');
    expect(html).toContain('overflow-hidden');
  });

  it('leaves a short entry whole', () => {
    const html = renderToStaticMarkup(
      React.createElement(JournalBody, { doc: doc('Short enough to read in place.') }),
    );
    expect(html).not.toContain('Read more');
  });

  it('renders the title as TEXT, never as markup', () => {
    // The title is author-supplied and arrives from rich_text, so it gets the
    // same treatment as the body: escaped, never interpreted.
    const html = renderToStaticMarkup(
      React.createElement(JournalBody, {
        doc: doc('body'),
        title: '<script>alert(1)</script>',
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('works with no title at all', () => {
    const html = renderToStaticMarkup(React.createElement(JournalBody, { doc: doc('body') }));
    expect(html).toContain('body');
    expect(html).toContain('Journal');
  });
});

describe('journalLayout', () => {
  it('leaves a short entry alone in both states', () => {
    for (const expanded of [false, true]) {
      expect(journalLayout(100, expanded)).toEqual({
        isLong: false,
        collapsed: false,
        scrolls: false,
      });
    }
  });

  it('collapses a long entry until it is opened', () => {
    expect(journalLayout(5000, false)).toEqual({
      isLong: true,
      collapsed: true,
      scrolls: false,
    });
  });

  it('SCROLLS an opened long entry rather than letting it grow', () => {
    // The whole point of the change: opened does not mean unbounded. A very
    // long entry that expanded freely would push the rest of the feed off
    // the screen, and a reader who changed their mind would have to scroll
    // past all of it.
    expect(journalLayout(5000, true)).toEqual({
      isLong: true,
      collapsed: false,
      scrolls: true,
    });
  });

  it('never both collapses and scrolls', () => {
    for (const len of [0, 899, 900, 901, 100000]) {
      for (const expanded of [false, true]) {
        const l = journalLayout(len, expanded);
        expect(l.collapsed && l.scrolls).toBe(false);
      }
    }
  });
});

describe('readingMinutes', () => {
  it('never reports zero', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('one')).toBe(1);
  });

  it('rounds up rather than down', () => {
    // 221 words is just over a minute and must not read as one.
    expect(readingMinutes(Array.from({ length: 221 }, () => 'w').join(' '))).toBe(2);
  });
});
