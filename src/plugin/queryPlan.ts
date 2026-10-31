import { ComparisonPlan } from '../utils/comparison';

type Fd = Record<string, any>;

export interface QueryPlan {
  /** Indice della query del riferimento (sempre 0). */
  ref: 0;
  /** Indice della query del confronto, se il confronto e' attivo. */
  cmp?: number;
  /** Indici delle query dei totali esatti. */
  refTotal?: number;
  cmpTotal?: number;
  comparison: ComparisonPlan;
}

/** Il chart ha una colonna temporale su cui applicare una finestra di confronto. */
export function hasTemporalColumn(fd: Fd): boolean {
  if (fd.dc_time_column) return true;
  if (fd.extra_form_data?.granularity_sqla) return true;
  return (fd.adhoc_filters ?? []).some((f: any) => f?.operator === 'TEMPORAL_RANGE');
}

/** Senza colonna temporale il confronto non si puo' applicare: resta disattivato. */
export function guardComparison(comparison: ComparisonPlan, fd: Fd): ComparisonPlan {
  if (comparison.active && !hasTemporalColumn(fd)) {
    return { active: false, source: 'none', reason: 'no_temporal_column' };
  }
  return comparison;
}

/**
 * Decide quante query servono e in che ordine. E' l'unico punto che stabilisce
 * gli indici: buildQuery e transformProps li leggono solo da qui.
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
