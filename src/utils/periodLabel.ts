import { PeriodInfo } from '../types';
import { detectGranularity, formatDateIt, labelForRange, MonthStyle } from './dates';

/**
 * Periodo a partire dai limiti restituiti da Superset (from_dttm / to_dttm, epoch in ms, UTC).
 * Il limite superiore e' escluso. Un limite mancante diventa un intervallo aperto.
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
    return { raw: null, range: null, granularity: 'all', label: 'Tutto il periodo' };
  }
  if (!hasFrom) {
    return { raw: null, range: null, granularity: 'open_end', label: `fino al ${formatDateIt(new Date((toMs as number) - 1))}` };
  }
  if (!hasTo) {
    return { raw: null, range: null, granularity: 'open_start', label: `dal ${formatDateIt(new Date(fromMs as number))}` };
  }
  const range = { start: new Date(fromMs as number), end: new Date(toMs as number) };
  if (range.end.getTime() <= range.start.getTime()) {
    return { raw: null, range: null, granularity: null, label: fallback };
  }
  return { raw: null, range, granularity: detectGranularity(range), label: labelForRange(range, monthStyle) };
}
