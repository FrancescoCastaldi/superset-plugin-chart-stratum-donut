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

describe('transformProps: comparison from the dashboard filter', () => {
  test('active comparison, labels from the result bounds', () => {
    const t = transformProps(props());
    expect(t.comparisonActive).toBe(true);
    expect(t.periods.header).toBe('Oct 2026 vs Oct 2025');
    expect(t.periods.refLabel).toBe('Oct 2026');
    expect(t.comparisonType).toBe('values');
  });

  test('slices merged: Shipped with change, Cancelled new', () => {
    const t = transformProps(props());
    const shipped = t.model.slices.find(s => s.key === 'Shipped')!;
    const cancelled = t.model.slices.find(s => s.key === 'Cancelled')!;
    expect(shipped.deltaPct).toBeCloseTo(33.33, 1);
    expect(shipped.trend).toBe('up');
    expect(cancelled.isNew).toBe(true);
    expect(t.model.slices[0].key).toBe('Shipped');
  });

  test('no time_compare and no preset: comparison off with a notice', () => {
    const t = transformProps(props({ extra_form_data: { time_range: '2026-10-01 : 2026-11-01' }, dc_compare_source: 'dashboard' }), [
      { data: [{ status: 'A', 'SUM(sales)': 1 }], rowcount: 1, from_dttm: JAN, to_dttm: NOV },
    ]);
    expect(t.comparisonActive).toBe(false);
    expect(t.notices.some(n => n.text.includes('dashboard filter'))).toBe(true);
    expect(t.model.hasComparison).toBe(false);
  });

  test('without a time column the comparison does not activate', () => {
    const t = transformProps(props({ dc_time_column: undefined, adhoc_filters: [] }, [
      { data: [{ status: 'A', 'SUM(sales)': 1 }], rowcount: 1, from_dttm: JAN, to_dttm: NOV },
    ]));
    expect(t.comparisonActive).toBe(false);
    expect(t.notices.some(n => n.text.includes('time column'))).toBe(true);
  });
});

describe('transformProps: limits and open periods', () => {
  test('truncated reference: warning and unknown keys', () => {
    const t = transformProps(props({ row_limit: 2 }));
    const warning = t.notices.find(n => n.level === 'warning' && n.text.includes('Reference truncated'));
    expect(warning?.text).toContain('shares are approximate');
    expect(warning?.text).toContain('Exact total');
  });

  test('period without bounds: "Full period"', () => {
    const t = transformProps(props({ dc_compare_source: 'none' }, [
      { data: [{ status: 'A', 'SUM(sales)': 1 }], rowcount: 1, from_dttm: null, to_dttm: null },
    ]));
    expect(t.periods.refLabel).toBe('Full period');
    expect(t.comparisonActive).toBe(false);
  });

  test('custom labels override the automatic ones', () => {
    const t = transformProps(props({ dc_ref_label: 'This year', dc_cmp_label: 'Last year' }));
    expect(t.periods.header).toBe('This year vs Last year');
  });
});

describe('transformProps: metrics mode', () => {
  test('one slice per metric, in the declared order', () => {
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

  test('total metric as denominator', () => {
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
