import { describe, it, expect } from 'bun:test';
import { isUnavailableReason, messageAffordance } from '../usePermissions';

/**
 * "Can I message this person" has THREE answers, and collapsing them to two is
 * the bug this guards. The middle one — a text-only request until they accept —
 * is the common case for a stranger on the default
 * who_can_message = everyone_message_requests: {allowed: false, fallback:
 * "message_request"}. Treating that as a refusal would hide the control people
 * are actually meant to use.
 */
describe('messageAffordance', () => {
  it('is loading until the server has answered', () => {
    expect(messageAffordance(undefined).state).toBe('loading');
  });

  it('opens a thread when allowed', () => {
    expect(messageAffordance({ allowed: true }).state).toBe('open');
  });

  it('offers a REQUEST rather than refusing when that is the fallback', () => {
    const a = messageAffordance({ allowed: false, fallback: 'message_request' });
    expect(a).toEqual({ state: 'request', label: 'Send request' });
  });

  it('refuses with the current reason names, and says why', () => {
    expect(messageAffordance({ allowed: false, reason: 'messages_off' })).toEqual({
      state: 'blocked',
      label: 'Not taking messages right now',
      reason: 'messages_off',
    });
    expect(messageAffordance({ allowed: false, reason: 'no_one' }).state).toBe('blocked');
    expect(messageAffordance({ allowed: false, reason: 'unavailable' }).label).toBe('Unavailable');
    expect(messageAffordance({ allowed: false, reason: 'people_i_follow' }).label).toBe('Only accepts messages from people they follow');
  });

  it('reads the older names as the new ones (a block stays unavailable)', () => {
    expect(messageAffordance({ allowed: false, reason: 'blocked' })).toMatchObject({ label: 'Unavailable', reason: 'unavailable' });
    expect(messageAffordance({ allowed: false, reason: 'chat_paused' })).toMatchObject({ reason: 'messages_off' });
    expect(isUnavailableReason('unavailable')).toBe(true);
    expect(isUnavailableReason('blocked')).toBe(true);
    expect(isUnavailableReason('no_one')).toBe(false);
    expect(isUnavailableReason(undefined)).toBe(false);
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
