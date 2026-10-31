import transformProps from '../src/plugin/transformProps';

const JAN = Date.UTC(2026, 9, 1);
const NOV = Date.UTC(2026, 10, 1);
const PREV_JAN = Date.UTC(2025, 9, 1);
const PREV_NOV = Date.UTC(2025, 10, 1);

function props(overrides: Record<string, any> = {}, queries?: any[]) {
  return {
    width: 500,
    height: 400,
    rawFormData: {
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
      ...overrides,
    },
    queriesData: queries ?? [
      {
        data: [{ status: 'Shipped', 'SUM(sales)': 800 }, { status: 'Cancelled', 'SUM(sales)': 50 }],
        rowcount: 2,
        from_dttm: JAN,
        to_dttm: NOV,
      },
      {
        data: [{ status: 'Shipped', 'SUM(sales)': 600 }],
        rowcount: 1,
        from_dttm: PREV_JAN,
        to_dttm: PREV_NOV,
      },
    ],
  } as any;
}

describe('transformProps: confronto dal filtro dashboard', () => {
  test('confronto attivo, etichette dai limiti del risultato', () => {
    const t = transformProps(props());
    expect(t.comparisonActive).toBe(true);
    expect(t.periods.header).toBe('Ott 2026 vs Ott 2025');
    expect(t.periods.refLabel).toBe('Ott 2026');
    expect(t.comparisonType).toBe('values');
  });

  test('fette unite: Shipped con variazione, Cancelled nuova', () => {
    const t = transformProps(props());
    const shipped = t.model.slices.find(s => s.key === 'Shipped')!;
    const cancelled = t.model.slices.find(s => s.key === 'Cancelled')!;
    expect(shipped.deltaPct).toBeCloseTo(33.33, 1);
    expect(shipped.trend).toBe('up');
    expect(cancelled.isNew).toBe(true);
    expect(t.model.slices[0].key).toBe('Shipped');
  });

  test('senza time_compare e senza preset: confronto assente con nota', () => {
    const t = transformProps(props({ extra_form_data: { time_range: '2026-10-01 : 2026-11-01' }, dc_compare_source: 'dashboard' }), [
      { data: [{ status: 'A', 'SUM(sales)': 1 }], rowcount: 1, from_dttm: JAN, to_dttm: NOV },
    ]);
    expect(t.comparisonActive).toBe(false);
    expect(t.notices.some(n => n.text.includes('filtro dashboard'))).toBe(true);
    expect(t.model.hasComparison).toBe(false);
  });

  test('senza colonna temporale il confronto non si attiva', () => {
    const t = transformProps(props({ dc_time_column: undefined, adhoc_filters: [] }, [
      { data: [{ status: 'A', 'SUM(sales)': 1 }], rowcount: 1, from_dttm: JAN, to_dttm: NOV },
    ]));
    expect(t.comparisonActive).toBe(false);
    expect(t.notices.some(n => n.text.includes('colonna temporale'))).toBe(true);
  });
});

describe('transformProps: limiti e periodi aperti', () => {
  test('riferimento troncato: avviso e chiavi sconosciute', () => {
    const t = transformProps(props({ row_limit: 2 }));
    const warning = t.notices.find(n => n.level === 'warning' && n.text.includes('Riferimento troncato'));
    expect(warning?.text).toContain('quote approssimate');
    expect(warning?.text).toContain('Totale esatto');
  });

  test('periodo senza limiti: "Tutto il periodo"', () => {
    const t = transformProps(props({ dc_compare_source: 'none' }, [
      { data: [{ status: 'A', 'SUM(sales)': 1 }], rowcount: 1, from_dttm: null, to_dttm: null },
    ]));
    expect(t.periods.refLabel).toBe('Tutto il periodo');
    expect(t.comparisonActive).toBe(false);
  });

  test('etichette personalizzate sovrascrivono quelle automatiche', () => {
    const t = transformProps(props({ dc_ref_label: 'Quest\'anno', dc_cmp_label: 'Lo scorso' }));
    expect(t.periods.header).toBe('Quest\'anno vs Lo scorso');
  });
});

describe('transformProps: modalita\' metriche', () => {
  test('una fetta per metrica, nell\'ordine dichiarato', () => {
    const t = transformProps(props({
      dc_mode: 'metrics',
      metrics: ['SUM(FlagBook)', 'SUM(FlagBookFailed)'],
      metric: undefined,
      groupby: [],
      dc_compare_source: 'none',
      extra_form_data: {},
    }, [
      { data: [{ 'SUM(FlagBook)': 8, 'SUM(FlagBookFailed)': 2 }], rowcount: 1, from_dttm: JAN, to_dttm: NOV },
    ]));
    expect(t.model.slices.map(s => [s.key, s.refValue])).toEqual([['SUM(FlagBook)', 8], ['SUM(FlagBookFailed)', 2]]);
  });

  test('metrica totale come denominatore', () => {
    const t = transformProps(props({
      dc_mode: 'metrics',
      metrics: ['SUM(FlagBook)'],
      dc_total_metric: 'COUNT(*)',
      dc_compare_source: 'none',
      extra_form_data: {},
    }, [
      { data: [{ 'SUM(FlagBook)': 8, 'COUNT(*)': 20 }], rowcount: 1, from_dttm: JAN, to_dttm: NOV },
    ]));
    const slice = t.model.slices.find(s => s.key === 'SUM(FlagBook)')!;
    expect(slice.refShare).toBeCloseTo(0.4);
    expect(t.model.slices.some(s => s.key === 'COUNT(*)')).toBe(false);
  });
});
