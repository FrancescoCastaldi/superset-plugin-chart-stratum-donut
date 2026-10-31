import { relativeToShift, resolveComparison } from '../src/utils/comparison';

const base = { dc_compare_source: 'auto', dc_compare_preset: 'previous_period' };

describe('resolveComparison: filtro dashboard PeriodCompare', () => {
  test('intervallo esplicito dal filtro: confronto come range', () => {
    const plan = resolveComparison({
      ...base,
      extra_form_data: { time_range: '2026-10-01 : 2026-11-01', time_compare: ['2025-10-01 : 2025-11-01'], comparison_type: 'difference' },
    });
    expect(plan).toEqual({
      active: true,
      source: 'dashboard',
      window: { kind: 'range', range: '2025-10-01 : 2025-11-01' },
      comparisonType: 'difference',
    });
  });

  test('time_compare nativo come shift', () => {
    const plan = resolveComparison({ ...base, extra_form_data: { time_range: '2026-10-01 : 2026-11-01', time_compare: ['1 year ago'] } });
    expect(plan).toMatchObject({ active: true, source: 'dashboard', window: { kind: 'shift', shift: '1 year ago' } });
  });

  test('shift senza riferimento limitato: non attivo', () => {
    const plan = resolveComparison({ ...base, extra_form_data: { time_range: 'No filter', time_compare: ['1 year ago'] } });
    expect(plan).toEqual({ active: false, source: 'none', reason: 'no_reference_range' });
  });

  test('source = chart ignora il filtro dashboard', () => {
    const plan = resolveComparison({
      ...base,
      dc_compare_source: 'chart',
      dc_compare_preset: 'previous_year',
      extra_form_data: { time_range: '2026-10-01 : 2026-11-01', time_compare: ['2020-01-01 : 2020-02-01'] },
    });
    expect(plan).toMatchObject({ active: true, source: 'chart', window: { kind: 'shift', shift: '1 year ago' } });
  });

  test('source = dashboard senza time_compare: non attivo', () => {
    const plan = resolveComparison({ ...base, dc_compare_source: 'dashboard', extra_form_data: { time_range: '2026-10-01 : 2026-11-01' } });
    expect(plan).toEqual({ active: false, source: 'none', reason: 'no_dashboard_comparison' });
  });

  test('source = none: disattivato anche se il filtro ha un confronto', () => {
    const plan = resolveComparison({ ...base, dc_compare_source: 'none', extra_form_data: { time_range: '2026-10-01 : 2026-11-01', time_compare: ['1 year ago'] } });
    expect(plan).toEqual({ active: false, source: 'none', reason: 'disabled' });
  });
});

describe('resolveComparison: preset del chart', () => {
  test('periodo precedente di un mese esplicito calcolato nel browser', () => {
    const plan = resolveComparison({ ...base, extra_form_data: { time_range: '2026-10-01 : 2026-11-01' } });
    expect(plan).toEqual({
      active: true,
      source: 'chart',
      window: { kind: 'range', range: '2026-09-01 : 2026-10-01' },
      comparisonType: 'values',
    });
  });

  test.each([
    ['previous_year', '1 year ago'],
    ['previous_quarter', '3 months ago'],
    ['previous_month', '1 month ago'],
    ['previous_week', '1 week ago'],
    ['same_weekday_last_year', '52 weeks ago'],
  ])('preset %s', (preset, shift) => {
    const plan = resolveComparison({ ...base, dc_compare_preset: preset, extra_form_data: { time_range: '2026-10-01 : 2026-11-01' } });
    expect(plan).toMatchObject({ active: true, window: { kind: 'shift', shift } });
  });

  test('riferimento relativo: "Last month" diventa uno shift', () => {
    const plan = resolveComparison({ ...base, extra_form_data: { time_range: 'Last month' } });
    expect(plan).toMatchObject({ active: true, window: { kind: 'shift', shift: '1 month ago' } });
  });

  test('riferimento relativo non mappabile', () => {
    const plan = resolveComparison({ ...base, extra_form_data: { time_range: 'DATEADD(DATETIME("today"), -3, month)' } });
    expect(plan).toEqual({ active: false, source: 'none', reason: 'unsupported_relative' });
  });

  test('nessun riferimento: non attivo', () => {
    expect(resolveComparison({ ...base })).toEqual({ active: false, source: 'none', reason: 'no_reference_range' });
  });

  test('custom: intervallo esplicito usato cosi com\'e\'', () => {
    const plan = resolveComparison({
      ...base,
      dc_compare_preset: 'custom',
      dc_compare_custom_range: '2024-01-01 : 2024-02-01',
    });
    expect(plan).toMatchObject({ active: true, window: { kind: 'range', range: '2024-01-01 : 2024-02-01' } });
  });

  test('il filtro temporale del chart sostituisce il riferimento mancante', () => {
    const plan = resolveComparison({ ...base, dc_compare_preset: 'previous_year' }, '2026-10-01 : 2026-11-01');
    expect(plan).toMatchObject({ active: true, window: { kind: 'shift', shift: '1 year ago' } });
  });
});

describe('relativeToShift', () => {
  test.each([
    ['Last year', '1 year ago'],
    ['previous calendar month', '1 month ago'],
    ['Last 3 days', '3 days ago'],
    ['Last 2 quarters', '6 months ago'],
    ['Last 10 weeks', '10 weeks ago'],
  ])('%s -> %s', (expr, shift) => expect(relativeToShift(expr)).toBe(shift));
  test('non supportato', () => expect(relativeToShift('next month')).toBeNull());
});
