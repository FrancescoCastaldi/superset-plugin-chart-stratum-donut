import { PeriodInfo } from '../types';
import { detectGranularity, formatDate, labelForRange, MonthStyle } from './dates';

/**
 * Period from the bounds returned by Superset (from_dttm / to_dttm, epoch in ms, UTC).
 * The upper bound is excluded. A missing bound becomes an open interval.
 */
export function periodFromBounds(
  fromMs: number | null | undefined,
  toMs: number | null | undefined,
  fallback: string,
  monthStyle: MonthStyle = 'short',
): PeriodInfo {
  const hasFrom = typeof fromMs === 'number';
  const hasTo = typeof toMs === 'number';
  if (!hasFrom && !hasTo) {
    return { raw: null, range: null, granularity: 'all', label: 'Full period' };
  }
  if (!hasFrom) {
    return { raw: null, range: null, granularity: 'open_end', label: `until ${formatDate(new Date((toMs as number) - 1))}` };
  }
  if (!hasTo) {
    return { raw: null, range: null, granularity: 'open_start', label: `from ${formatDate(new Date(fromMs as number))}` };
  }
  const range = { start: new Date(fromMs as number), end: new Date(toMs as number) };
  if (range.end.getTime() <= range.start.getTime()) {
    return { raw: null, range: null, granularity: null, label: fallback };
  }
  return { raw: null, range, granularity: detectGranularity(range), label: labelForRange(range, monthStyle) };
}
