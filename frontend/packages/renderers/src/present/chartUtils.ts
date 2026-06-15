/** 投票／次數軸刻度：僅整數；小範圍逐格、大範圍約 5 格。 */
export function buildCountAxisTicks(maxCount: number): number[] {
  const max = Math.max(0, Math.ceil(maxCount));
  if (max <= 6) {
    return Array.from({ length: max + 1 }, (_, i) => i);
  }

  const targetTickCount = 5;
  const step = Math.max(1, Math.ceil(max / (targetTickCount - 1)));
  const ticks: number[] = [0];
  for (let value = step; value < max; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== max) {
    ticks.push(max);
  }
  return ticks;
}

/** 次數軸上限：至少 1，避免全 0 時刻度擠在一起。 */
export function countAxisMax(values: number[]): number {
  const peak = values.length > 0 ? Math.max(...values) : 0;
  return Math.max(1, peak);
}
