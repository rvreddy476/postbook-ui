import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * DM consent contract §4: the Message control follows the server's decision
 * and a tap OPENS THE THREAD (the earlier "a tap only sends, never navigates"
 * rule is superseded). The labels and reasons are pure logic, tested in
 * lib/chat/__tests__/dmConsent.test.ts; this guards the wiring.
 */
const source = readFileSync(join(import.meta.dir, '..', 'MessageButton.tsx'), 'utf8');

describe('MessageButton', () => {
  it('reads the decision through messageButtonView', () => {
    expect(source).toContain("usePermissions([targetUserId], ['message'])");
    expect(source).toContain('messageButtonView(');
  });

  it('opens the thread it created or found', () => {
    expect(source).toContain('getOrCreateDirectConversation');
    expect(source).toContain('router.push(threadHref(created.id))');
  });

  it('decides "request" from the server flag, never from a missing one', () => {
    // The bug: `is_request !== false` called a normal chat a request.
    expect(source).not.toContain('is_request !== false');
    expect(source).toContain('readCreatedConversation');
  });

  it('draws nothing for an unavailable person, and explains a refusal', () => {
    expect(source).toContain("view.kind === 'hidden'");
    expect(source).toContain('createConversationErrorText');
  });

  it('uses a round bubble', () => {
    expect(source).toContain('MessageCircle');
    expect(source).not.toContain('MessagesSquare');
  });
});
