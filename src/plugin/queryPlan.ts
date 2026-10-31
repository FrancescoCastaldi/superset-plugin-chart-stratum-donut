import { ComparisonPlan } from '../utils/comparison';

type Fd = Record<string, any>;

export interface QueryPlan {
  /** Index of the reference query (always 0). */
  ref: 0;
  /** Index of the comparison query, if the comparison is active. */
  cmp?: number;
  /** Indexes of the exact-total queries. */
  refTotal?: number;
  cmpTotal?: number;
  comparison: ComparisonPlan;
}

/** The chart has a time column the comparison window can be applied to. */
export function hasTemporalColumn(fd: Fd): boolean {
  if (fd.dc_time_column) return true;
  if (fd.extra_form_data?.granularity_sqla) return true;
  return (fd.adhoc_filters ?? []).some((f: any) => f?.operator === 'TEMPORAL_RANGE');
}

/** Without a time column the comparison cannot be applied: it stays disabled. */
export function guardComparison(comparison: ComparisonPlan, fd: Fd): ComparisonPlan {
  if (comparison.active && !hasTemporalColumn(fd)) {
    return { active: false, source: 'none', reason: 'no_temporal_column' };
  }
  return comparison;
}

/**
 * Decides how many queries are needed and in which order. This is the only place
 * that sets the indexes: buildQuery and transformProps read them only from here.
 */
export function planQueries(comparison: ComparisonPlan, exactTotal: boolean): QueryPlan {
  let next = 1;
  const plan: QueryPlan = { ref: 0, comparison };
  if (comparison.active) plan.cmp = next++;
  if (exactTotal) {
    plan.refTotal = next++;
    if (comparison.active) plan.cmpTotal = next++;
  }
  return plan;
}

export function queryCount(plan: QueryPlan): number {
  return 1 + (plan.cmp !== undefined ? 1 : 0) + (plan.refTotal !== undefined ? 1 : 0) + (plan.cmpTotal !== undefined ? 1 : 0);
}
