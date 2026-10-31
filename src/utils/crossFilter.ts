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

/** Una fetta e' filtrabile se ha un valore reale (non nullo) e non e' un raggruppamento. */
export function isFilterable(slice: { raw?: unknown; isOther?: boolean; key: string }): boolean {
  if (slice.isOther || slice.key === '__other__' || slice.key === '__rest__') return false;
  return slice.raw !== undefined && slice.raw !== null;
}

/** Aggiunge o toglie una fetta dalla selezione, senza duplicati. */
export function toggleSelection(current: SelectedSlice[], clicked: SelectedSlice): SelectedSlice[] {
  return current.some(s => s.key === clicked.key)
    ? current.filter(s => s.key !== clicked.key)
    : [...current, clicked];
}

/**
 * Maschera di filtro per il cross-filter di Superset: clic su una fetta aggiunge o toglie
 * il suo valore dal filtro IN sulla colonna. Nessuna selezione rimuove il filtro.
 * Restituisce null se la fetta non e' filtrabile.
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

/** Payload del menu contestuale: drill to detail sulla fetta cliccata. */
export function drillToDetailFilters(
  column: string,
  clicked: { key: string; raw?: unknown; label: string; isOther?: boolean },
): { col: string; op: '=='; val: unknown; formattedVal: string }[] {
  if (!isFilterable(clicked)) return [];
  return [{ col: column, op: '==', val: clicked.raw, formattedVal: clicked.label }];
}
