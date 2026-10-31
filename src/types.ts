/** Direction of the delta. 'none' = zero base (new slice), shown as "New". */
export type TrendDirection = 'up' | 'down' | 'flat' | 'none';

/** Where the slices come from: values of a column, or one slice per metric. */
export type SliceMode = 'column' | 'metrics';

/** What to show for a slice. */
export type ValueDisplay = 'value' | 'percent' | 'value_percent';

/** Meaning of the delta: for "lower_is_better" a decrease is positive. */
export type Polarity = 'higher_is_better' | 'lower_is_better' | 'neutral';

/** Slice sort (always on the reference period, "Other" at the end). */
export type SliceSort = 'value_desc' | 'value_asc' | 'label' | 'data';

/** Delta shown per slice: share points, percentage change of the value, or both. */
export type DeltaMode = 'points' | 'percent' | 'both' | 'none';

/** Half-open interval [start, end), in UTC. */
export interface PeriodRange {
  start: Date;
  end: Date;
}

export type Granularity = 'all' | 'open_start' | 'open_end' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface PeriodInfo {
  /** Original string received (e.g. "2026-10-01 : 2026-11-01" or "Last month"). */
  raw: string | null;
  /** Explicit range, if the string can be parsed. */
  range: PeriodRange | null;
  granularity: Granularity | null;
  /** Readable label, e.g. "Oct 2026", "2026", "2026-10-01 - 2026-10-15". */
  label: string;
}

/** Normalized row: one slice with both periods already merged. */
export interface SliceDatum {
  key: string;
  label: string;
  refValue: number;
  cmpValue: number | null;
  /** Shares in [0, 1] of the total of the respective period. */
  refShare: number;
  cmpShare: number | null;
  deltaAbs: number | null;
  /** Percentage change of the value (reference vs comparison), null if the base is zero. */
  deltaPct: number | null;
  /** Change of the share in percentage points. */
  deltaPts: number | null;
  /** Direction of the value change. */
  trend: TrendDirection;
  /** Direction of the share change (points). */
  trendShare: TrendDirection;
  /** Present in the reference but missing in the comparison. */
  isNew: boolean;
  /** Present only in the comparison. */
  isGone: boolean;
  isOther: boolean;
  /** 'ref' or 'cmp' if that period reached the row limit: the value is not known. */
  unknown: 'none' | 'ref' | 'cmp';
  /** Original dimension value (for the cross-filter), absent for Other and Others. */
  raw?: unknown;
  /** Keys grouped into "Other". */
  members?: string[];
}

export interface MergeResult {
  slices: SliceDatum[];
  refTotal: number;
  cmpTotal: number | null;
  hasComparison: boolean;
  /** Negative values found: they make no sense in a donut, so they are treated as 0. */
  negativeKeys: string[];
}
