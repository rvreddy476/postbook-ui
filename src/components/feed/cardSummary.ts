/*
  The counts line above a card's buttons: likes on the left, "3 comments ·
  1 share" on the right. The buttons underneath say what they do (Like,
  Comment, Share, Save) rather than carrying the numbers.
*/
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim(n / 1000)}K`;
  return `${trim(n / 1_000_000)}M`;
}

function trim(value: number): string {
  // 1.0K reads as noise; 12.5K keeps its decimal; 125K drops it.
  return value >= 100 ? String(Math.floor(value)) : String(Math.floor(value * 10) / 10);
}

export function countWord(n: number, one: string, many: string): string {
  return `${compactCount(n)} ${n === 1 ? one : many}`;
}
