import { describe, it, expect, beforeEach } from 'bun:test';

/**
 * Suggestion lists filtered on connection_status === 'pending_sent', which was
 * right while the control sent a CONNECTION request. It sends a MESSAGE
 * request now, and that never sets connection_status — so the filter stopped
 * matching and somebody just messaged stayed in "People you may know", asking
 * to be messaged again, crowding out someone actionable.
 */

// A sessionStorage stand-in: bun's test env has no DOM.
const store = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;
(globalThis as unknown as { window: unknown }).window = globalThis;

const { markRequestSent } = await import('../useSentRequests');

describe('sent message requests', () => {
  beforeEach(() => store.clear());

  it('records who has been messaged', () => {
    markRequestSent('user-a');
    const raw = JSON.parse(store.get('postbook_sent_message_requests') ?? '[]');
    expect(raw).toContain('user-a');
  });

  it('survives a reload within the session', () => {
    markRequestSent('user-b');
    // What a fresh page load would read back.
    const raw = JSON.parse(store.get('postbook_sent_message_requests') ?? '[]');
    expect(raw).toContain('user-b');
  });

  it('does not duplicate on a repeat send', () => {
    markRequestSent('user-c');
    markRequestSent('user-c');
    const raw = JSON.parse(store.get('postbook_sent_message_requests') ?? '[]') as string[];
    expect(raw.filter((id) => id === 'user-c')).toHaveLength(1);
  });

  it('ignores an empty id rather than storing one', () => {
    markRequestSent('');
    const raw = JSON.parse(store.get('postbook_sent_message_requests') ?? '[]') as string[];
    expect(raw).not.toContain('');
  });
});
