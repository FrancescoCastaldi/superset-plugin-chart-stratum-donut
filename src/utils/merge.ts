import { MergeResult, SliceDatum, SliceSort, TrendDirection } from '../types';
import { computeDelta } from './trend';

export interface PeriodRow {
  key: string;
  label?: string;
  value: number | null | undefined;
  /** Original dimension value, used for the cross-filter. */
  raw?: unknown;
}

export interface MergeOptions {
  /** Threshold in % (0-100): reference slices below it go to "Other". 0 = disabled. */
  otherThreshold?: number;
  /** Alternative to the threshold: the top N slices stay, the rest goes to "Other". */
  otherTopN?: number;
  otherLabel?: string;
  restLabel?: string;
  sort?: SliceSort;
  /** The period reached the row_limit: missing keys are unknown, not zero. */
  refTruncated?: boolean;
  cmpTruncated?: boolean;
  /** Exact totals from a dedicated query. If larger than the sum, the difference is the "rest" slice. */
  refDenominator?: number | null;
  cmpDenominator?: number | null;
}

export const OTHER_KEY = '__other__';
export const REST_KEY = '__rest__';

type Unknown = SliceDatum['unknown'];

function clean(value: number | null | undefined): { value: number; negative: boolean } {
  if (value === null || value === undefined || Number.isNaN(value)) return { value: 0, negative: false };
  return value < 0 ? { value: 0, negative: true } : { value, negative: false };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Share direction: below 0.05 points the slice is flat. */
function shareTrend(deltaPts: number | null): TrendDirection {
  if (deltaPts === null) return 'flat';
  if (deltaPts > 0.05) return 'up';
  if (deltaPts < -0.05) return 'down';
  return 'flat';
}

function buildSlice(
  key: string,
  label: string,
  refValue: number,
  cmpValue: number,
  refTotal: number,
  cmpTotal: number | null,
  hasComparison: boolean,
  unknown: Unknown,
): SliceDatum {
  const refKnown = unknown !== 'ref';
  const cmpKnown = unknown !== 'cmp';
  const refShare = refKnown && refTotal > 0 ? refValue / refTotal : 0;
  let cmpShare: number | null = null;
  if (hasComparison && cmpKnown) cmpShare = cmpTotal && cmpTotal > 0 ? cmpValue / cmpTotal : 0;
  const bothKnown = unknown === 'none';
  const delta = hasComparison && bothKnown ? computeDelta(refValue, cmpValue) : null;
  const deltaPts = bothKnown && cmpShare !== null ? (refShare - cmpShare) * 100 : null;
  return {
    key,
    label,
    refValue,
    cmpValue: hasComparison && cmpKnown ? cmpValue : null,
    refShare,
    cmpShare,
    deltaAbs: delta ? delta.deltaAbsolute : null,
    deltaPct: delta ? delta.deltaPercent : null,
    deltaPts,
    trend: delta ? delta.trendDirection : 'flat',
    trendShare: shareTrend(deltaPts),
    isNew: bothKnown && hasComparison && refValue > 0 && cmpValue === 0,
    isGone: bothKnown && hasComparison && refValue === 0 && cmpValue > 0,
    isOther: false,
    unknown,
  };
}

function sortSlices(slices: SliceDatum[], sort: SliceSort): SliceDatum[] {
  const order = new Map(slices.map((s, i) => [s.key, i]));
  const tail = (s: SliceDatum) => (s.key === REST_KEY ? 2 : s.isOther ? 1 : 0);
  const byValue = (a: SliceDatum, b: SliceDatum) =>
    a.refValue - b.refValue || (a.cmpValue ?? 0) - (b.cmpValue ?? 0) || a.label.localeCompare(b.label, 'en');
  const sorted = [...slices];
  sorted.sort((a, b) => {
    const t = tail(a) - tail(b);
    if (t !== 0) return t;
    if (sort === 'value_desc') return byValue(b, a);
    if (sort === 'value_asc') return byValue(a, b);
    if (sort === 'label') return a.label.localeCompare(b.label, 'en');
    return (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0);
  });
  return sorted;
}

/**
 * Merges reference and comparison with a full join on the slice key: slices present
 * in only one period are kept (isNew / isGone). A truncated period does not produce
 * invented zeros: missing keys stay unknown.
 */
export function mergePeriods(ref: PeriodRow[], cmp: PeriodRow[] | null, opts: MergeOptions = {}): MergeResult {
  const hasComparison = cmp !== null;
  const labels = new Map<string, string>();
  const refValues = new Map<string, number>();
  const cmpValues = new Map<string, number>();
  const refPresent = new Set<string>();
  const cmpPresent = new Set<string>();
  const negative = new Set<string>();
  const rawOf = new Map<string, unknown>();
  const keys: string[] = [];
  const seen = new Set<string>();

  const ingest = (rows: PeriodRow[], into: Map<string, number>, present: Set<string>) => {
    rows.forEach(row => {
      const { value, negative: isNeg } = clean(row.value);
      if (isNeg) negative.add(row.key);
      if (!seen.has(row.key)) {
        seen.add(row.key);
        keys.push(row.key);
        labels.set(row.key, row.label ?? row.key);
      }
      present.add(row.key);
      if (!rawOf.has(row.key) && row.raw !== undefined) rawOf.set(row.key, row.raw);
      into.set(row.key, (into.get(row.key) ?? 0) + value);
    });
  };
  ingest(ref, refValues, refPresent);
  if (cmp) ingest(cmp, cmpValues, cmpPresent);

  const unknownOf = (key: string): Unknown => {
    if (opts.refTruncated && !refPresent.has(key)) return 'ref';
    if (hasComparison && opts.cmpTruncated && !cmpPresent.has(key)) return 'cmp';
    return 'none';
  };

  const knownRef = keys.filter(k => unknownOf(k) !== 'ref');
  const knownCmp = keys.filter(k => unknownOf(k) !== 'cmp');
  const knownRefSum = sum(knownRef.map(k => refValues.get(k) ?? 0));
  const knownCmpSum = sum(knownCmp.map(k => cmpValues.get(k) ?? 0));
  const refTotal = opts.refDenominator ?? knownRefSum;
  const cmpTotal = hasComparison ? (opts.cmpDenominator ?? knownCmpSum) : null;

  let slices: SliceDatum[] = keys.map(key => ({ ...buildSlice(
      key,
      labels.get(key) ?? key,
      refValues.get(key) ?? 0,
      cmpValues.get(key) ?? 0,
      refTotal,
      cmpTotal,
      hasComparison,
      unknownOf(key),
    ), raw: rawOf.get(key) }));

  // "Other": small slices in the reference and, if present, also in the comparison.
  const candidates = slices.filter(s => s.unknown === 'none');
  let small: SliceDatum[] = [];
  if (opts.otherTopN && opts.otherTopN > 0) {
    small = [...candidates].sort((a, b) => b.refValue - a.refValue).slice(opts.otherTopN);
  } else if (opts.otherThreshold && opts.otherThreshold > 0) {
    const thr = opts.otherThreshold / 100;
    small = candidates.filter(s => s.refShare < thr && (s.cmpShare === null || s.cmpShare < thr));
  }
  if (small.length >= 2) {
    const smallKeys = new Set(small.map(s => s.key));
    const other = buildSlice(
      OTHER_KEY,
      opts.otherLabel ?? 'Other',
      sum(small.map(s => s.refValue)),
      sum(small.map(s => s.cmpValue ?? 0)),
      refTotal,
      cmpTotal,
      hasComparison,
      'none',
    );
    other.isOther = true;
    other.members = small.map(s => s.key);
    slices = [...slices.filter(s => !smallKeys.has(s.key)), other];
  }

  // "Rest" slice: how much of the exact total is not in the returned rows.
  const restRef = opts.refDenominator != null ? opts.refDenominator - knownRefSum : 0;
  const restCmp = hasComparison && opts.cmpDenominator != null ? opts.cmpDenominator - knownCmpSum : 0;
  if (restRef > 0) {
    const rest = buildSlice(
      REST_KEY,
      opts.restLabel ?? 'Others (beyond the limit)',
      restRef,
      Math.max(0, restCmp),
      refTotal,
      cmpTotal,
      hasComparison,
      'none',
    );
    rest.isOther = true;
    slices = [...slices, rest];
  }

  return {
    slices: sortSlices(slices, opts.sort ?? 'value_desc'),
    refTotal,
    cmpTotal,
    hasComparison,
    negativeKeys: [...negative],
  };
}
