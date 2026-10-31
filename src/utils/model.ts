import { Polarity, SliceDatum, SliceSort } from '../types';
import { mergePeriods, MergeOptions, PeriodRow } from './merge';
import { getTrendPolarity, TrendPolarity } from './trend';
import { Mode } from './rows';

/** Configurazione di una singola fetta, dal controllo ColumnConfigControl. */
export interface SliceConfig {
  name?: string;
  hidden?: boolean;
  polarity?: Polarity | 'inherit';
  color?: string;
}

export interface OtherOptions {
  mode: 'threshold' | 'top_n' | 'none';
  threshold?: number;
  topN?: number;
  label?: string;
}

export interface BuildModelInput {
  mode: Mode;
  ref: PeriodRow[];
  cmp: PeriodRow[] | null;
  refTruncated?: boolean;
  cmpTruncated?: boolean;
  refDenominator?: number | null;
  cmpDenominator?: number | null;
  sliceConfig?: Record<string, SliceConfig>;
  defaultPolarity?: Polarity;
  other?: OtherOptions;
  sort?: SliceSort;
  hideZero?: boolean;
  colorFor: (key: string, index: number) => string;
}

export interface SliceModel extends SliceDatum {
  polarity: Polarity;
  sentiment: TrendPolarity;
  color: string;
}

export interface DonutModel {
  slices: SliceModel[];
  refTotal: number;
  cmpTotal: number | null;
  hasComparison: boolean;
  negativeKeys: string[];
  hiddenCount: number;
  hiddenZeroCount: number;
}

const OTHER_COLOR = '#BFBFBF';

/** Converte la configurazione grezza di ColumnConfigControl nella forma usata dal modello. */
export function toSliceConfig(raw: Record<string, any> | undefined | null): Record<string, SliceConfig> {
  const out: Record<string, SliceConfig> = {};
  Object.entries(raw ?? {}).forEach(([key, c]) => {
    if (!c || typeof c !== 'object') return;
    const polarity = c.dc_polarity as Polarity | 'inherit' | undefined;
    out[key] = {
      name: c.customColumnName || undefined,
      hidden: c.visible === false,
      color: c.dc_color || undefined,
      polarity: polarity && polarity !== 'inherit' ? polarity : undefined,
    };
  });
  return out;
}

/**
 * Costruisce il modello del donut: filtra le fette nascoste, unisce i periodi,
 * applica nomi, colori e polarita', e rimuove le fette a zero se richiesto.
 * Le fette nascoste escono prima del join, quindi le quote si ricalcolano da sole.
 */
export function buildModel(input: BuildModelInput): DonutModel {
  const cfg = input.sliceConfig ?? {};
  const hiddenKeys = new Set<string>();
  const visible = (rows: PeriodRow[]) =>
    rows.filter(r => {
      if (cfg[r.key]?.hidden) {
        hiddenKeys.add(r.key);
        return false;
      }
      return true;
    }).map(r => ({ ...r, label: cfg[r.key]?.name || r.label || r.key }));

  const other = input.other ?? { mode: 'threshold', threshold: 2 };
  const opts: MergeOptions = {
    otherThreshold: other.mode === 'threshold' ? other.threshold ?? 0 : 0,
    otherTopN: other.mode === 'top_n' ? other.topN : undefined,
    otherLabel: other.label,
    sort: input.sort ?? 'value_desc',
    refTruncated: input.refTruncated,
    cmpTruncated: input.cmpTruncated,
    refDenominator: input.refDenominator,
    cmpDenominator: input.cmpDenominator,
  };

  const merged = mergePeriods(visible(input.ref), input.cmp ? visible(input.cmp) : null, opts);
  const defaultPolarity = input.defaultPolarity ?? 'higher_is_better';

  let hiddenZeroCount = 0;
  const slices: SliceModel[] = [];
  merged.slices.forEach((s, index) => {
    const isZeroRow = !s.isOther && s.unknown === 'none' && s.refValue === 0 && (s.cmpValue ?? 0) === 0;
    if (input.hideZero && isZeroRow) {
      hiddenZeroCount += 1;
      return;
    }
    const c = cfg[s.key] ?? {};
    const polarity: Polarity = c.polarity && c.polarity !== 'inherit' ? c.polarity : defaultPolarity;
    const color = c.color || (s.isOther ? OTHER_COLOR : input.colorFor(s.key, index));
    slices.push({ ...s, polarity, sentiment: getTrendPolarity(s.trend, polarity), color });
  });

  return {
    slices,
    refTotal: merged.refTotal,
    cmpTotal: merged.cmpTotal,
    hasComparison: merged.hasComparison,
    negativeKeys: merged.negativeKeys.filter(k => !hiddenKeys.has(k)),
    hiddenCount: hiddenKeys.size,
    hiddenZeroCount,
  };
}
