import { describe, expect, test } from 'bun:test';
import { postTimeLabel } from '@/lib/postTime';
import { isDoubleTap, mediaFrameRatio, FLATTEST_FRAME, TALLEST_FRAME } from '../mediaFrame';
import { compactCount, countWord } from '../cardSummary';

const NOW = new Date(2026, 9, 19, 12, 0, 0).getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('postTimeLabel', () => {
  test('recent times are short', () => {
    expect(postTimeLabel(ago(20_000), NOW)).toBe('just now');
    expect(postTimeLabel(ago(5 * 60_000), NOW)).toBe('5m');
    expect(postTimeLabel(ago(2 * 3_600_000), NOW)).toBe('2h');
    expect(postTimeLabel(ago(3 * 86_400_000), NOW)).toBe('3d');
  });
  test('a week or more is a date, never 9/6/2026', () => {
    expect(postTimeLabel(new Date(2026, 8, 6, 10).toISOString(), NOW)).toBe('6 Sep');
    expect(postTimeLabel(new Date(2025, 11, 31, 10).toISOString(), NOW)).toBe('31 Dec 2025');
  });
  test('a bad date prints nothing', () => {
    expect(postTimeLabel('not a date', NOW)).toBe('');
  });
});

describe('mediaFrameRatio', () => {
  test('a photo keeps its shape inside the limits', () => {
    expect(mediaFrameRatio(1600, 1200)).toBeCloseTo(4 / 3);
    expect(mediaFrameRatio(1080, 1080)).toBe(1);
  });
  test('a tall phone photo stops at 4:5 and a panorama at 1.91:1', () => {
    expect(mediaFrameRatio(1080, 1920)).toBe(TALLEST_FRAME);
    expect(mediaFrameRatio(4000, 1000)).toBe(FLATTEST_FRAME);
  });
  test('an unknown size is square', () => {
    expect(mediaFrameRatio(undefined, 600)).toBe(1);
    expect(mediaFrameRatio(0, 0)).toBe(1);
  });
});

describe('isDoubleTap', () => {
  const first = { t: 1000, x: 100, y: 100 };
  test('two quick taps in one place', () => {
    expect(isDoubleTap(first, { t: 1250, x: 108, y: 104 })).toBe(true);
  });
  test('too slow, too far, or no first tap', () => {
    expect(isDoubleTap(first, { t: 1400, x: 100, y: 100 })).toBe(false);
    expect(isDoubleTap(first, { t: 1200, x: 160, y: 100 })).toBe(false);
    expect(isDoubleTap(null, first)).toBe(false);
  });
});

describe('card counts', () => {
  test('compact numbers', () => {
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1000)).toBe('1K');
    expect(compactCount(12_540)).toBe('12.5K');
    expect(compactCount(125_900)).toBe('125K');
    expect(compactCount(2_300_000)).toBe('2.3M');
  });
  test('one and many', () => {
    expect(countWord(1, 'comment', 'comments')).toBe('1 comment');
    expect(countWord(3, 'comment', 'comments')).toBe('3 comments');
  });
});
