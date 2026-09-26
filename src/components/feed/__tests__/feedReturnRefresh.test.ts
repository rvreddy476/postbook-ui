import { describe, expect, test } from 'bun:test';
import { installFeedReturnRefresh } from '../feedReturnRefresh';
import { alignedSearchWidth } from '../useFeedSearchAlignment';

function harness(refresh: () => Promise<unknown>) {
  let time = 0;
  let focused = true;
  const win = Object.assign(new EventTarget(), { navigator: { onLine: true } });
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => focused });
  const dispose = installFeedReturnRefresh(win as unknown as Window, doc as unknown as Document, refresh, () => time);
  return { win, doc, dispose, advance: (ms: number) => { time += ms; },
    away: () => { focused = false; win.dispatchEvent(new Event('blur')); doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); },
    back: () => { focused = true; doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); win.dispatchEvent(new Event('focus')); },
  };
}
const tick = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
describe('return-to-feed policy', () => {
  test('short switches do not refresh; one minute away refreshes exactly once across both events', async () => {
    let calls = 0;
    const h = harness(async () => { calls++; });
    h.away(); h.advance(59_999); h.back(); await tick(); expect(calls).toBe(0);
    h.away(); h.advance(60_000); h.back(); await tick(); expect(calls).toBe(1);
    h.back(); await tick(); expect(calls).toBe(1); h.dispose();
  });
  test('being idle but still on the page never reloads; offline return waits for connectivity', async () => {
    let calls = 0;
    const h = harness(async () => { calls++; });
    h.advance(120_000); h.back(); await tick(); expect(calls).toBe(0);
    h.away(); h.advance(60_000); h.win.navigator.onLine = false; h.back(); await tick(); expect(calls).toBe(0);
    h.win.navigator.onLine = true; h.win.dispatchEvent(new Event('online')); await tick(); expect(calls).toBe(1); h.dispose();
  });
  test('held refresh never duplicates, and cleanup removes listeners', async () => {
    let calls = 0; let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const h = harness(async () => { calls++; await held; });
    h.away(); h.advance(60_000); h.back(); await tick(); h.back(); await tick(); expect(calls).toBe(1);
    h.dispose(); release(); await tick(); h.away(); h.advance(60_000); h.back(); await tick(); expect(calls).toBe(1);
  });
  test('a failed attempt does not prevent the next eligible return', async () => {
    let calls = 0; const h = harness(async () => { calls++; throw new Error('offline'); });
    h.away(); h.advance(60_000); h.back(); await tick();
    h.away(); h.advance(60_000); h.back(); await tick(); expect(calls).toBe(2); h.dispose();
  });
});
test('aligned search matches feed width where possible and never overflows remaining space', () => {
  expect(alignedSearchWidth(452, 500)).toBe(452);
  expect(alignedSearchWidth(452, 216)).toBe(216);
  expect(alignedSearchWidth(452, 179)).toBe(0);
  expect(alignedSearchWidth(296, -20)).toBe(0);
});
