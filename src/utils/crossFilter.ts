export interface SelectedSlice {
  key: string;
  raw: unknown;
}

export interface FilterClause {
  col: string;
  op: 'IN';
  val: unknown[];
}

export interface CrossFilterMask {
  extraFormData: { filters?: FilterClause[] };
  filterState: { value: unknown[] | null; selectedValues: string[] };
}

/** A slice is filterable if it has a real (non-null) value and is not a group. */
export function isFilterable(slice: { raw?: unknown; isOther?: boolean; key: string }): boolean {
  if (slice.isOther || slice.key === '__other__' || slice.key === '__rest__') return false;
  return slice.raw !== undefined && slice.raw !== null;
}

/** Adds or removes a slice from the selection, without duplicates. */
export function toggleSelection(current: SelectedSlice[], clicked: SelectedSlice): SelectedSlice[] {
  return current.some(s => s.key === clicked.key)
    ? current.filter(s => s.key !== clicked.key)
    : [...current, clicked];
}

/**
 * Filter mask for the Superset cross-filter: clicking a slice adds or removes its value
 * from the IN filter on the column. An empty selection removes the filter.
 * Returns null if the slice is not filterable.
 */
export function crossFilterMask(
  column: string,
  current: SelectedSlice[],
  clicked: { key: string; raw?: unknown; isOther?: boolean },
): CrossFilterMask | null {
  if (!isFilterable(clicked)) return null;
  const next = toggleSelection(current, { key: clicked.key, raw: clicked.raw });
  if (next.length === 0) {
    return { extraFormData: {}, filterState: { value: null, selectedValues: [] } };
  }
  const values = next.map(s => s.raw);
  return {
    extraFormData: { filters: [{ col: column, op: 'IN', val: values }] },
    filterState: { value: values, selectedValues: next.map(s => s.key) },
  };
}

/** Context menu payload: drill to detail on the clicked slice. */
export function drillToDetailFilters(
  column: string,
  clicked: { key: string; raw?: unknown; label: string; isOther?: boolean },
): { col: string; op: '=='; val: unknown; formattedVal: string }[] {
  if (!isFilterable(clicked)) return [];
  return [{ col: column, op: '==', val: clicked.raw, formattedVal: clicked.label }];
}
