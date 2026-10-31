import { Polarity, TrendDirection } from '../types';

/** Delta % magnitude at or below which the trend is reported as flat. */
export const TREND_FLAT_THRESHOLD = 0.001;

export type TrendPolarity = 'positive' | 'negative' | 'neutral';

export interface DeltaResult {
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  trendDirection: TrendDirection;
  isZeroBaseline?: boolean;
}

/**
 * Percentage change of primaryValue against comparisonValue, relative to
 * the absolute baseline. A zero baseline yields 0% when both values are zero
 * and null (Nuovo indicator) when primaryValue is non-zero.
 */
export function computeDeltaPercent(primaryValue: number, comparisonValue: number): number | null {
  const deltaAbsolute = primaryValue - comparisonValue;
  if (comparisonValue !== 0) {
    return (deltaAbsolute / Math.abs(comparisonValue)) * 100;
  }
  if (primaryValue === 0) {
    return 0;
  }
  return null;
}

export function getTrendDirection(deltaPercent: number): TrendDirection {
  if (deltaPercent > TREND_FLAT_THRESHOLD) {
    return 'up';
  }
  if (deltaPercent < -TREND_FLAT_THRESHOLD) {
    return 'down';
  }
  return 'flat';
}

/** Absolute delta, delta % and trend direction; handles zero baseline. */
export function computeDelta(primaryValue: number | null, comparisonValue: number | null): DeltaResult {
  if (primaryValue === null || comparisonValue === null) {
    return { deltaAbsolute: null, deltaPercent: null, trendDirection: 'flat', isZeroBaseline: false };
  }
  const deltaAbsolute = primaryValue - comparisonValue;
  const isZeroBaseline = comparisonValue === 0 && primaryValue !== 0;

  if (isZeroBaseline) {
    return { deltaAbsolute, deltaPercent: null, trendDirection: 'none', isZeroBaseline: true };
  }

  const deltaPercent = computeDeltaPercent(primaryValue, comparisonValue);
  return {
    deltaAbsolute,
    deltaPercent,
    trendDirection: deltaPercent !== null ? getTrendDirection(deltaPercent) : 'flat',
    isZeroBaseline: false,
  };
}

/**
 * Semantic meaning of a trend: with "lower_is_better" (e.g. failed bookings)
 * a decrease is good and an increase is bad; "neutral" never colours.
 */
export function getTrendPolarity(trendDirection: TrendDirection, polarity: Polarity): TrendPolarity {
  if (polarity === 'neutral') return 'neutral';
  const invert = polarity === 'lower_is_better';
  if (trendDirection === 'up') {
    return invert ? 'negative' : 'positive';
  }
  if (trendDirection === 'down') {
    return invert ? 'positive' : 'negative';
  }
  return 'neutral';
}
