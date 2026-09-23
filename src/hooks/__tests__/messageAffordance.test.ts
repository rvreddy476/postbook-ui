import { describe, it, expect } from 'bun:test';
import { messageAffordance } from '../usePermissions';

/**
 * "Can I message this person" has THREE answers, and collapsing them to two is
 * the bug this guards. The middle one — a text-only request until they accept —
 * is the common case: every account on dev sits on the default
 * who_can_message = everyone_message_requests, so a stranger resolves to
 * {allowed: false, fallback: "message_request"}. Treating that as a refusal
 * would hide the control people are actually meant to use.
 */
describe('messageAffordance', () => {
  it('is loading until the server has answered', () => {
    expect(messageAffordance(undefined).state).toBe('loading');
  });

  it('opens a thread when allowed', () => {
    expect(messageAffordance({ allowed: true }).state).toBe('open');
  });

  it('offers a REQUEST rather than refusing when that is the fallback', () => {
    const a = messageAffordance({ allowed: false, fallback: 'message_request', reason: 'not_connected' });
    expect(a.state).toBe('request');
  });

  it('blocks when there is no fallback, and says why', () => {
    expect(messageAffordance({ allowed: false, reason: 'chat_paused' })).toEqual({
      state: 'blocked',
      label: 'Not accepting messages right now',
    });
    expect(messageAffordance({ allowed: false, reason: 'privacy_no_one' }).state).toBe('blocked');
    expect(messageAffordance({ allowed: false, reason: 'blocked' }).label).toBe('Unavailable');
  });

  it('fails CLOSED on a reason it has never seen', () => {
    // A new rule added to the engine must not become an enabled button here
    // by default. Unknown means disabled, not allowed.
    const a = messageAffordance({ allowed: false, reason: 'some_future_rule' });
    expect(a.state).toBe('blocked');
  });

  it('honours allowed even when a reason rides along', () => {
    expect(messageAffordance({ allowed: true, reason: 'whatever' }).state).toBe('open');
  });

  it('ignores a fallback it does not understand', () => {
    // follow_request is a real fallback for the follow action; it must not
    // open a messaging affordance.
    expect(messageAffordance({ allowed: false, fallback: 'follow_request' }).state).toBe('blocked');
  });
});
