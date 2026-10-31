// Scenari di esempio: formData e risultati di query nella forma che Superset passa al plugin.
// Le date dei risultati (from_dttm / to_dttm) sono in epoch ms UTC, come le restituisce il server.

const ref = (y: number, m: number) => Date.UTC(y, m, 1);
const OCT26 = { from_dttm: ref(2026, 9), to_dttm: ref(2026, 10) };
const OCT25 = { from_dttm: ref(2025, 9), to_dttm: ref(2025, 10) };

const columnFd = (extra: Record<string, unknown> = {}) => ({
  dc_mode: 'column',
  metric: 'SUM(sales)',
  groupby: ['status'],
  row_limit: 100,
  adhoc_filters: [],
  dc_time_column: 'order_date',
  dc_compare_source: 'auto',
  dc_compare_preset: 'previous_period',
  extra_form_data: {
    time_range: '2026-10-01 : 2026-11-01',
    time_compare: ['2025-10-01 : 2025-11-01'],
    comparison_type: 'values',
  },
  ...extra,
});

const metricsFd = (extra: Record<string, unknown> = {}) => ({
  dc_mode: 'metrics',
  metrics: ['SUM(riuscite)', 'SUM(fallite)', 'SUM(incomplete)'],
  dc_total_metric: null,
  adhoc_filters: [],
  dc_time_column: 'data',
  dc_compare_source: 'auto',
  dc_compare_preset: 'previous_period',
  dc_slice_config: {
    'SUM(fallite)': { dc_polarity: 'lower_is_better' },
    'SUM(incomplete)': { dc_polarity: 'lower_is_better' },
  },
  extra_form_data: {
    time_range: '2026-10-01 : 2026-11-01',
    time_compare: ['2025-10-01 : 2025-11-01'],
    comparison_type: 'values',
  },
  ...extra,
});

const rows = (pairs: [string, number][]) => pairs.map(([status, v]) => ({ status, 'SUM(sales)': v }));

export interface Scenario {
  id: string;
  name: string;
  formData: Record<string, any>;
  queries: { data: Record<string, any>[]; rowcount: number; from_dttm: number | null; to_dttm: number | null }[];
  width?: number;
  dark?: boolean;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'column-basic',
    name: 'Colonna: riferimento e confronto (Ott 2026 vs Ott 2025)',
    formData: columnFd(),
    queries: [
      { data: rows([['Shipped', 800], ['Cancelled', 120], ['On Hold', 80], ['Disputed', 40]]), rowcount: 4, ...OCT26 },
      { data: rows([['Shipped', 600], ['Cancelled', 150], ['On Hold', 90]]), rowcount: 3, ...OCT25 },
    ],
  },
  {
    id: 'metrics-outcomes',
    name: 'Metriche: esiti prenotazioni (fallite e incomplete: meglio se minori)',
    formData: metricsFd(),
    queries: [
      { data: [{ 'SUM(riuscite)': 1240, 'SUM(fallite)': 180, 'SUM(incomplete)': 90 }], rowcount: 1, ...OCT26 },
      { data: [{ 'SUM(riuscite)': 1000, 'SUM(fallite)': 250, 'SUM(incomplete)': 140 }], rowcount: 1, ...OCT25 },
    ],
  },
  {
    id: 'new-gone',
    name: 'Fette nuove e scomparse',
    formData: columnFd(),
    queries: [
      { data: rows([['A', 300], ['B', 200], ['C', 100]]), rowcount: 3, ...OCT26 },
      { data: rows([['B', 180], ['C', 90], ['D', 60]]), rowcount: 3, ...OCT25 },
    ],
  },
  {
    id: 'zero-baseline',
    name: 'Base zero: fetta nuova con "Nuovo"',
    formData: columnFd(),
    queries: [
      { data: rows([['Nuova linea', 500], ['Storica', 500]]), rowcount: 2, ...OCT26 },
      { data: rows([['Storica', 500]]), rowcount: 1, ...OCT25 },
    ],
  },
  {
    id: 'no-comparison',
    name: 'Senza confronto: un solo anello',
    formData: columnFd({ dc_compare_source: 'none' }),
    queries: [{ data: rows([['Shipped', 800], ['Cancelled', 120]]), rowcount: 2, ...OCT26 }],
  },
  {
    id: 'relative-reference',
    name: 'Riferimento relativo "Last month" con preset anno precedente',
    formData: columnFd({
      dc_compare_preset: 'previous_year',
      extra_form_data: { time_range: 'Last month' },
    }),
    queries: [
      { data: rows([['Shipped', 800], ['Cancelled', 120]]), rowcount: 2, from_dttm: ref(2026, 9), to_dttm: ref(2026, 10) },
      { data: rows([['Shipped', 640], ['Cancelled', 100]]), rowcount: 2, from_dttm: ref(2025, 9), to_dttm: ref(2025, 10) },
    ],
  },
  {
    id: 'truncated',
    name: 'Riga limite raggiunta: fette mancanti sconosciute',
    formData: columnFd({ row_limit: 3 }),
    queries: [
      { data: rows([['A', 300], ['B', 200], ['C', 100]]), rowcount: 3, ...OCT26 },
      { data: rows([['B', 180], ['D', 60], ['E', 30]]), rowcount: 3, ...OCT25 },
    ],
  },
  {
    id: 'many-with-other',
    name: '25 categorie: raggruppamento in Altro',
    formData: columnFd({ dc_other_mode: 'threshold', dc_other_threshold: 3 }),
    queries: [
      {
        data: Array.from({ length: 25 }, (_, i) => ({ status: `Categoria ${String(i + 1).padStart(2, '0')}`, 'SUM(sales)': Math.round(1000 / (i + 1) ** 1.3) + 1 })),
        rowcount: 25,
        ...OCT26,
      },
      {
        data: Array.from({ length: 25 }, (_, i) => ({ status: `Categoria ${String(i + 1).padStart(2, '0')}`, 'SUM(sales)': Math.round(900 / (i + 1) ** 1.2) + 1 })),
        rowcount: 25,
        ...OCT25,
      },
    ],
  },
  {
    id: 'negative',
    name: 'Valore negativo (non rappresentabile)',
    formData: columnFd(),
    queries: [
      { data: rows([['Rimborsi', -50], ['Vendite', 400]]), rowcount: 2, ...OCT26 },
      { data: rows([['Rimborsi', -20], ['Vendite', 380]]), rowcount: 2, ...OCT25 },
    ],
  },
  {
    id: 'dashboard-filter',
    name: 'Filtro dashboard PeriodCompare (confronto esplicito)',
    formData: columnFd({ dc_compare_source: 'auto', extra_form_data: { time_range: '2026-10-15 : 2026-11-01', time_compare: ['2025-10-15 : 2025-11-01'], comparison_type: 'percentage' } }),
    queries: [
      { data: rows([['Shipped', 400], ['Cancelled', 60]]), rowcount: 2, from_dttm: Date.UTC(2026, 9, 15), to_dttm: Date.UTC(2026, 10, 1) },
      { data: rows([['Shipped', 330], ['Cancelled', 80]]), rowcount: 2, from_dttm: Date.UTC(2025, 9, 15), to_dttm: Date.UTC(2025, 10, 1) },
    ],
  },
  {
    id: 'narrow-360',
    name: 'Larghezza 360 px: legenda in basso',
    formData: columnFd({ dc_legend_position: 'bottom' }),
    width: 360,
    queries: [
      { data: rows([['Shipped', 800], ['Cancelled', 120], ['On Hold', 80]]), rowcount: 3, ...OCT26 },
      { data: rows([['Shipped', 600], ['Cancelled', 150], ['On Hold', 90]]), rowcount: 3, ...OCT25 },
    ],
  },
  {
    id: 'dark',
    name: 'Tema scuro',
    formData: columnFd(),
    dark: true,
    queries: [
      { data: rows([['Shipped', 800], ['Cancelled', 120], ['On Hold', 80]]), rowcount: 3, ...OCT26 },
      { data: rows([['Shipped', 600], ['Cancelled', 150], ['On Hold', 90]]), rowcount: 3, ...OCT25 },
    ],
  },
];
