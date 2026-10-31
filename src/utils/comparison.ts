import { parseTimeRange, shiftRange, toTimeRangeString } from './dates';

export type CompareSource = 'auto' | 'dashboard' | 'chart' | 'none';
export type ComparisonType = 'values' | 'difference' | 'percentage' | 'ratio';

export type InactiveReason =
  | 'disabled'
  | 'no_dashboard_comparison'
  | 'no_reference_range'
  | 'unsupported_relative'
  | 'no_temporal_column';

export type ComparisonWindow =
  | { kind: 'range'; range: string }
  | { kind: 'shift'; shift: string };

export type ComparisonPlan =
  | { active: false; source: 'none'; reason: InactiveReason }
  | { active: true; source: 'dashboard' | 'chart'; window: ComparisonWindow; comparisonType: ComparisonType };

/** Superset relative expressions (case-insensitive) converted into a shift. */
const RELATIVE_SHIFTS: Record<string, string> = {
  'last day': '1 day ago',
  'last week': '1 week ago',
  'last month': '1 month ago',
  'last quarter': '3 months ago',
  'last year': '1 year ago',
  'previous calendar week': '1 week ago',
  'previous calendar month': '1 month ago',
  'previous calendar year': '1 year ago',
  'current day': '1 day ago',
  'current week': '1 week ago',
  'current month': '1 month ago',
  'current quarter': '3 months ago',
  'current year': '1 year ago',
};

const LAST_N_RE = /^last (\d+) (second|minute|hour|day|week|month|quarter|year)s?$/i;

const PRESET_SHIFTS: Record<string, string> = {
  previous_year: '1 year ago',
  previous_quarter: '3 months ago',
  previous_month: '1 month ago',
  previous_week: '1 week ago',
  same_weekday_last_year: '52 weeks ago',
};

const NO_FILTER = new Set(['', 'no filter']);

function isUnbounded(expr: string | null | undefined): boolean {
  return !expr || NO_FILTER.has(expr.trim().toLowerCase());
}

/** Converts a relative expression into a shift, or null if it is not supported. */
export function relativeToShift(expr: string): string | null {
  const key = expr.trim().toLowerCase();
  if (RELATIVE_SHIFTS[key]) return RELATIVE_SHIFTS[key];
  const m = key.match(LAST_N_RE);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'quarter') return `${n * 3} months ago`;
  return `${n} ${unit}s ago`;
}

/** Previous period for an explicit range, as in the PeriodCompare filter. */
function previousPeriodWindow(reference: string): ComparisonWindow | null {
  const range = parseTimeRange(reference);
  if (!range) return null;
  return { kind: 'range', range: toTimeRangeString(shiftRange(range, 'previous_period')) };
}

function inactive(reason: InactiveReason): ComparisonPlan {
  return { active: false, source: 'none', reason };
}

/**
 * Chooses the comparison period. Order of the rules:
 *  1. source = none: no comparison.
 *  2. source = auto | dashboard: if the PeriodCompare dashboard filter (or a native
 *     time_compare) has a value, it is used; the value is an explicit range or a shift.
 *  3. source = dashboard without time_compare: no comparison.
 *  4. chart preset, computed on the reference.
 *
 * @param fd formData in snake_case form (extra_form_data, dc_* ...).
 * @param temporalFilterValue value of the chart's TEMPORAL_RANGE filter, if present.
 */
export function resolveComparison(
  fd: Record<string, any>,
  temporalFilterValue?: string | null,
): ComparisonPlan {
  const source = (fd.dc_compare_source ?? 'auto') as CompareSource;
  if (source === 'none') return inactive('disabled');

  const extra = fd.extra_form_data ?? {};
  const reference: string | null = extra.time_range || temporalFilterValue || null;
  const comparisonType = (extra.comparison_type ?? 'values') as ComparisonType;

  const dashboardCmp = ([] as unknown[])
    .concat(extra.time_compare ?? [])
    .find((v): v is string => typeof v === 'string' && v.trim() !== '');

  if ((source === 'auto' || source === 'dashboard') && dashboardCmp) {
    const window: ComparisonWindow = parseTimeRange(dashboardCmp)
      ? { kind: 'range', range: dashboardCmp }
      : { kind: 'shift', shift: dashboardCmp.trim() };
    if (window.kind === 'shift' && isUnbounded(reference)) return inactive('no_reference_range');
    return { active: true, source: 'dashboard', window, comparisonType };
  }
  if (source === 'dashboard') return inactive('no_dashboard_comparison');

  // Chart preset.
  const preset = (fd.dc_compare_preset ?? 'previous_period') as string;
  if (preset === 'custom') {
    const custom: string | null = fd.dc_compare_custom_range ?? null;
    if (isUnbounded(custom)) return inactive('no_reference_range');
    const window: ComparisonWindow = parseTimeRange(custom!)
      ? { kind: 'range', range: custom! }
      : { kind: 'shift', shift: custom!.trim() };
    return { active: true, source: 'chart', window, comparisonType };
  }
  if (preset !== 'previous_period') {
    if (isUnbounded(reference)) return inactive('no_reference_range');
    return { active: true, source: 'chart', window: { kind: 'shift', shift: PRESET_SHIFTS[preset as keyof typeof PRESET_SHIFTS] }, comparisonType };
  }

  // previous_period: explicit -> computed in the browser; relative -> shift.
  if (isUnbounded(reference)) return inactive('no_reference_range');
  const explicit = previousPeriodWindow(reference!);
  if (explicit) return { active: true, source: 'chart', window: explicit, comparisonType };
  const shift = relativeToShift(reference!);
  if (shift) return { active: true, source: 'chart', window: { kind: 'shift', shift }, comparisonType };
  return inactive('unsupported_relative');
}
