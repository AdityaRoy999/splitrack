/** Divide rupees in whole paise, with the same participant order as the API. */
export function allocateSplitAmounts(total: number, weights: number[]): number[] {
  const totalPaise = Math.round(total * 100), sum = weights.reduce((value, weight) => value + weight, 0);
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0 || !Number.isFinite(sum) || sum <= 0 || weights.some(weight => !Number.isFinite(weight) || weight < 0)) return weights.map(() => 0);
  const exact = weights.map(weight => totalPaise * weight / sum), paise = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - paise[index] })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let remainder = totalPaise - paise.reduce((value, share) => value + share, 0);
  for (let index = 0; remainder > 0; index++) { paise[order[index % order.length].index]++; remainder--; }
  return paise.map(share => share / 100);
}
