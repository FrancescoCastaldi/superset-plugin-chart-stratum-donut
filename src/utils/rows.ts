import { PeriodRow } from './merge';
import { parseNumber } from './format';

export type Mode = 'column' | 'metrics';

/** Stable key of a slice, the same for the reference and the comparison. */
export function normalizeKey(v: unknown): string {
  if (v === null || v === undefined) return '<NULL>';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/** Name of a groupby column (a string or a Superset object). */
export function columnNameOf(g: any): string {
  if (typeof g === 'string') return g;
  return g?.column_name ?? g?.label ?? g?.sqlExpression ?? '';
}

/** Label Superset uses for a metric's column in the result. */
export function metricLabelOf(m: any): string {
  if (typeof m === 'string') return m;
  return m?.label ?? m?.optionName ?? m?.metric_name ?? m?.verbose_name ?? m?.sqlExpression ?? m?.column?.column_name ?? '';
}

/** Rows of a query as key/value pairs. Metrics mode: one slice per metric. */
export function readRows(
  data: Record<string, any>[],
  mode: Mode,
  groupby: string | null,
  metricLabels: string[],
): PeriodRow[] {
  if (mode === 'metrics') {
    const row = data[0] ?? {};
    return metricLabels.map(label => ({ key: label, label, value: parseNumber(row[label]) }));
  }
  if (!groupby || metricLabels.length === 0) return [];
  return data.map(row => {
    const key = normalizeKey(row[groupby]);
    return { key, label: key, value: parseNumber(row[metricLabels[0]]), raw: row[groupby] };
  });
}

/** The query reached the row_limit: the result may be incomplete. */
export function isTruncated(result: { rowcount?: number } | undefined, rowLimit: number | undefined): boolean {
  return typeof result?.rowcount === 'number' && rowLimit !== undefined && result.rowcount >= rowLimit;
}
