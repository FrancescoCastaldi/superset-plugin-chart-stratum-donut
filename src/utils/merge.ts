import { MergeResult, SliceDatum, SliceSort, TrendDirection } from '../types';
import { computeDelta } from './trend';

export interface PeriodRow {
  key: string;
  label?: string;
  value: number | null | undefined;
  /** Valore originale della dimensione, per il cross-filter. */
  raw?: unknown;
}

export interface MergeOptions {
  /** Soglia in % (0-100): fette sotto soglia nel riferimento vanno in "Altro". 0 = disattivato. */
  otherThreshold?: number;
  /** In alternativa alla soglia: le prime N fette restano, il resto va in "Altro". */
  otherTopN?: number;
  otherLabel?: string;
  restLabel?: string;
  sort?: SliceSort;
  /** Il periodo ha raggiunto il row_limit: le chiavi assenti non sono zero ma sconosciute. */
  refTruncated?: boolean;
  cmpTruncated?: boolean;
  /** Totali esatti da query dedicata. Se maggiori della somma, la differenza e' la fetta "rest". */
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

/** Direzione della quota: sotto 0,05 punti la fetta e' ferma. */
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
    a.refValue - b.refValue || (a.cmpValue ?? 0) - (b.cmpValue ?? 0) || a.label.localeCompare(b.label, 'it');
  const sorted = [...slices];
  sorted.sort((a, b) => {
    const t = tail(a) - tail(b);
    if (t !== 0) return t;
    if (sort === 'value_desc') return byValue(b, a);
    if (sort === 'value_asc') return byValue(a, b);
    if (sort === 'label') return a.label.localeCompare(b.label, 'it');
    return (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0);
  });
  return sorted;
}

/**
 * Unisce riferimento e confronto con un join completo sulla chiave della fetta:
 * le fette presenti in un solo periodo restano (isNew / isGone). Un periodo
 * troncato non produce zeri inventati: le chiavi assenti restano sconosciute.
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

  // "Altro": fette piccole nel riferimento e, se presenti, anche nel confronto.
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
      opts.otherLabel ?? 'Altro',
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

  // Fetta "rest": quanto del totale esatto non e' nelle righe restituite.
  const restRef = opts.refDenominator != null ? opts.refDenominator - knownRefSum : 0;
  const restCmp = hasComparison && opts.cmpDenominator != null ? opts.cmpDenominator - knownCmpSum : 0;
  if (restRef > 0) {
    const rest = buildSlice(
      REST_KEY,
      opts.restLabel ?? 'Altri (oltre il limite)',
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
