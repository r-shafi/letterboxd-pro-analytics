/**
 * Pure Mathematical & Statistical Functions
 * Implements deterministic algorithms for Bayesian shrinkage, Pearson r,
 * Shannon entropy, and dispersion metrics.
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function mode(values: number[]): number {
  if (values.length === 0) return 0;
  const freq = new Map<number, number>();
  let maxCount = 0;
  let modeVal = values[0];

  values.forEach((v) => {
    const c = (freq.get(v) || 0) + 1;
    freq.set(v, c);
    if (c > maxCount) {
      maxCount = c;
      modeVal = v;
    }
  });

  return modeVal;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sumSquares = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0);
  return Math.sqrt(sumSquares / values.length);
}

/**
 * Calculates Pearson correlation coefficient (r).
 * Minimum sample size threshold: n >= 20. Below that, returns null.
 */
export function pearsonCorrelation(x: number[], y: number[], minN = 20): number | null {
  if (x.length !== y.length || x.length < minN) return null;

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return 0;

  return Math.max(-1, Math.min(1, num / den));
}

/**
 * Bayesian Shrinkage formula:
 * adj = (n * groupMean + k * overallMean) / (n + k)
 * Defaults to k = 5.
 */
export function bayesianShrinkage(
  groupMean: number,
  groupN: number,
  overallMean: number,
  k = 5
): number {
  if (groupN === 0) return overallMean;
  return (groupN * groupMean + k * overallMean) / (groupN + k);
}

/**
 * Normalized Shannon Entropy:
 * H_norm = - sum(p_i * ln(p_i)) / ln(K)
 * Ranges from 0 (monoculture/all in one category) to 1 (perfectly even distribution).
 */
export function normalizedShannonEntropy(counts: number[]): number {
  const filtered = counts.filter((c) => c > 0);
  const K = filtered.length;
  if (K <= 1) return 0;

  const total = filtered.reduce((acc, c) => acc + c, 0);
  if (total === 0) return 0;

  let entropy = 0;
  for (const c of filtered) {
    const p = c / total;
    entropy -= p * Math.log(p);
  }

  return Math.max(0, Math.min(1, entropy / Math.log(K)));
}

/**
 * Formats decimal value to one decimal place.
 */
export function roundToOneDecimal(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Rounds decimal value to two decimal places.
 */
export function roundToTwoDecimals(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Standard rating formatter ensuring consistent 2-decimal display with star symbol (e.g. "3.11★").
 */
export function formatRating(rating: number | undefined | null, decimals = 2): string {
  if (rating === undefined || rating === null || isNaN(rating) || rating <= 0) {
    return 'N/A';
  }
  return `${rating.toFixed(decimals)}★`;
}

/**
 * Standard rating delta formatter (e.g. "+0.35★", "-0.12★").
 */
export function formatRatingDelta(delta: number | undefined | null, decimals = 2): string {
  if (delta === undefined || delta === null || isNaN(delta)) {
    return '0.00★';
  }
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${delta.toFixed(decimals)}★`;
}
