import { PeriodRow } from './merge';
import { parseNumber } from './format';

export type Mode = 'column' | 'metrics';

/** Chiave stabile di una fetta, uguale per riferimento e confronto. */
export function normalizeKey(v: unknown): string {
  if (v === null || v === undefined) return '<NULL>';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/** Nome di una colonna del groupby (stringa oppure oggetto Superset). */
export function columnNameOf(g: any): string {
  if (typeof g === 'string') return g;
  return g?.column_name ?? g?.label ?? g?.sqlExpression ?? '';
}

/** Etichetta con cui Superset chiama la colonna di una metrica nel risultato. */
export function metricLabelOf(m: any): string {
  if (typeof m === 'string') return m;
  return m?.label ?? m?.optionName ?? m?.metric_name ?? m?.verbose_name ?? m?.sqlExpression ?? m?.column?.column_name ?? '';
}

/** Righe di una query come coppie chiave/valore. Modalita' metriche: una fetta per metrica. */
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

/** La query ha raggiunto il row_limit: il risultato puo' essere incompleto. */
export function isTruncated(result: { rowcount?: number } | undefined, rowLimit: number | undefined): boolean {
  return typeof result?.rowcount === 'number' && rowLimit !== undefined && result.rowcount >= rowLimit;
}
