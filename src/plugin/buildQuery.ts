import { buildQueryContext, QueryFormData } from '@superset-ui/core';
import { resolveComparison, ComparisonPlan } from '../utils/comparison';
import { guardComparison, planQueries } from './queryPlan';

type Fd = Record<string, any>;

/** Toglie i campi di confronto nativi: il backend li scarterebbe comunque. */
function stripNative(q: Record<string, any>): Record<string, any> {
  const out = { ...q };
  delete out.time_compare;
  delete out.comparison_type;
  delete out.time_offsets;
  return out;
}

/** Aggiunge il TEMPORAL_RANGE sulla colonna scelta, se il chart non ne ha gia' uno. */
function ensureTemporalFilter(q: Record<string, any>, fd: Fd): Record<string, any> {
  if (q.granularity) return q;
  const filters: any[] = q.filters ?? [];
  if (filters.some(f => f.op === 'TEMPORAL_RANGE')) return q;
  const col = fd.dc_time_column;
  if (!col) return q;
  return { ...q, filters: [...filters, { col, op: 'TEMPORAL_RANGE', val: q.time_range ?? 'No filter' }] };
}

/** Colonne e metriche: identiche per riferimento e confronto. */
function shapeQuery(base: Record<string, any>, fd: Fd): Record<string, any> {
  if (fd.dc_mode === 'metrics') {
    const metrics = [...(fd.metrics ?? [])];
    if (fd.dc_total_metric) metrics.push(fd.dc_total_metric);
    return { ...base, columns: [], metrics, orderby: [] };
  }
  const groupby = (fd.groupby ?? []).slice(0, 1);
  const metric = fd.metric;
  return {
    ...base,
    columns: groupby,
    metrics: metric ? [metric] : [],
    orderby: metric ? [[metric, false]] : [],
    row_limit: fd.row_limit ?? 100,
  };
}

/** Totale esatto: nessuna colonna, una sola riga. */
function totalQuery(base: Record<string, any>, fd: Fd): Record<string, any> {
  return { ...base, columns: [], metrics: fd.metric ? [fd.metric] : [], orderby: [], row_limit: 1 };
}

/** Sposta la query su un intervallo esplicito o su uno shift relativo. */
function withWindow(q: Record<string, any>, comparison: ComparisonPlan): Record<string, any> {
  if (!comparison.active) return q;
  if (comparison.window.kind === 'range') return { ...q, time_range: comparison.window.range, time_shift: undefined };
  return { ...q, time_shift: comparison.window.shift };
}

export default function buildQuery(rawFormData: QueryFormData) {
  const fd = rawFormData as unknown as Fd;
  const temporalFilterValue = fd.adhoc_filters?.find((f: any) => f.operator === 'TEMPORAL_RANGE')?.comparator ?? null;
  const comparison = guardComparison(resolveComparison(fd, temporalFilterValue), fd);
  const plan = planQueries(comparison, Boolean(fd.dc_exact_total) && fd.dc_mode !== 'metrics');

  return buildQueryContext(rawFormData as any, (baseQueryObject: any) => {
    const base = stripNative(baseQueryObject);
    const queries: Record<string, any>[] = [ensureTemporalFilter(shapeQuery(base, fd), fd)];
    if (plan.cmp !== undefined) queries.push(ensureTemporalFilter(withWindow(shapeQuery(base, fd), comparison), fd));
    if (plan.refTotal !== undefined) queries.push(ensureTemporalFilter(totalQuery(base, fd), fd));
    if (plan.cmpTotal !== undefined) queries.push(ensureTemporalFilter(withWindow(totalQuery(base, fd), comparison), fd));
    return queries;
  });
}
