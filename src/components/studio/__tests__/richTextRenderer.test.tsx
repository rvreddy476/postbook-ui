import { describe, it, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import RichTextRenderer, { docToPlainText } from '../RichTextRenderer';

describe('RichTextRenderer whitelist', () => {
  it('renders allowed marks and nodes', () => {
    const html = renderToStaticMarkup(React.createElement(RichTextRenderer, {
      doc: { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hi', marks: [{ type: 'bold' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }] },
      ] },
    }));
    expect(html).toContain('<strong>hi</strong>');
    expect(html).toContain('<ul');
  });

  it('drops a javascript: link but keeps the words', () => {
    const html = renderToStaticMarkup(React.createElement(RichTextRenderer, {
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
      ] }] },
    }));
    expect(html).not.toContain('javascript');
    expect(html).not.toContain('<a');
    expect(html).toContain('click');
  });

  it('never emits an unknown node as markup', () => {
    const html = renderToStaticMarkup(React.createElement(RichTextRenderer, {
      doc: { type: 'doc', content: [
        { type: 'script', content: [{ type: 'text', text: 'alert(1)' }] },
        { type: 'paragraph', attrs: { onClick: 'alert(1)' }, content: [{ type: 'text', text: 'safe' }] },
      ] },
    }));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onClick');
    expect(html).not.toContain('onclick');
    expect(html).toContain('safe');
  });

  it('drops an unknown mark but keeps the text', () => {
    const html = renderToStaticMarkup(React.createElement(RichTextRenderer, {
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'x', marks: [{ type: 'evil', attrs: { style: 'position:fixed' } }] },
      ] }] },
    }));
    expect(html).not.toContain('position:fixed');
    expect(html).toContain('x');
  });

  it('flattens a document to plain text', () => {
    expect(docToPlainText({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
    ] })).toBe('Title\nBody');
  });
});

describe('RichTextRenderer attributes', () => {
  it('maps a known alignment and ignores an invented one', () => {
    const ok = renderToStaticMarkup(React.createElement(RichTextRenderer, {
      doc: { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'c' }] }] },
    }));
    expect(ok).toContain('text-center');

    const bad = renderToStaticMarkup(React.createElement(RichTextRenderer, {
      doc: { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: '"><script>alert(1)</script>' }, content: [{ type: 'text', text: 'c' }] }] },
    }));
    expect(bad).not.toContain('script');
    expect(bad).toContain('c');
  });

  it('renders a highlight as a mark element', () => {
    const html = renderToStaticMarkup(React.createElement(RichTextRenderer, {
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'h', marks: [{ type: 'highlight' }] }] }] },
    }));
    expect(html).toContain('<mark');
  });
});
