import { describe, it, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import JournalBody from '../JournalBody';
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
