import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The instruction was plain: tapping the message control sends a request and
 * does NOT open the messenger. It opened the messenger anyway — first because
 * I added a "they can already talk, so navigate" branch that was never asked
 * for, and then because the flag guarding that branch is ALSO false while the
 * permission check is in flight, so a quick tap raced it and navigated.
 *
 * Structural, because the failure is the PRESENCE of a navigation path rather
 * than a value some pure function returns. If the component has nothing to
 * navigate with, the bug cannot come back.
 */
const source = readFileSync(
  join(import.meta.dir, '..', 'MessageButton.tsx'),
  'utf8',
);

describe('MessageButton never navigates', () => {
  it('takes no navigation callback', () => {
    expect(source).not.toContain('onMessage');
  });

  it('does not route by itself either', () => {
    for (const escape of ['useRouter', 'router.push', 'next/link']) {
      expect(source).not.toContain(escape);
    }
  });

  it('sends by creating the conversation', () => {
    expect(source).toContain('getOrCreateDirectConversation');
  });

  it('reports what the SERVER did, not what the client guessed', () => {
    // The toast used to be chosen from the cached permission decision, which
    // is precisely the value that is wrong while it is still loading.
    expect(source).toContain('is_request');
  });

  it('uses a round bubble', () => {
    expect(source).toContain('MessageCircle');
    expect(source).not.toContain('MessagesSquare');
  });
});
