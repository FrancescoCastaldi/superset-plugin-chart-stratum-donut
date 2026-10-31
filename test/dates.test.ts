import {
  describePeriod,
  detectGranularity,
  isoWeek,
  labelForRange,
  parseTimeRange,
  shiftRange,
  toTimeRangeString,
} from '../src/utils/dates';

const r = (s: string) => parseTimeRange(s)!;

describe('parseTimeRange', () => {
  test('separatore del filtro PeriodCompare', () => {
    const range = r('2026-10-01 : 2026-11-01');
    expect(range.start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
  test('date ISO con orario e separatore compatto', () => {
    expect(parseTimeRange('2026-10-01T00:00:00:2026-10-08T00:00:00')).not.toBeNull();
  });
  test.each(['Last month', 'No filter', '', 'previous calendar year', '2026-11-01 : 2026-10-01'])(
    'non interpretabile o relativo: %s',
    raw => expect(parseTimeRange(raw)).toBeNull(),
  );
});

describe('detectGranularity e labelForRange', () => {
  test.each([
    ['2026-01-01 : 2027-01-01', 'year', '2026'],
    ['2026-10-01 : 2027-01-01', 'quarter', 'T4 2026'],
    ['2026-10-01 : 2026-11-01', 'month', 'Ott 2026'],
    ['2026-10-12 : 2026-10-19', 'week', 'Sett. 42 2026'],
    ['2026-10-15 : 2026-10-16', 'day', '15/10/2026'],
    ['2026-10-01 : 2026-10-16', 'custom', '01/10/2026 - 15/10/2026'],
  ])('%s -> %s (%s)', (raw, gran, label) => {
    expect(detectGranularity(r(raw))).toBe(gran);
    expect(labelForRange(r(raw))).toBe(label);
  });
  test('mese esteso', () => {
    expect(labelForRange(r('2026-10-01 : 2026-11-01'), 'long')).toBe('Ottobre 2026');
  });
  test('settimana ISO a cavallo d\'anno', () => {
    expect(isoWeek(new Date(Date.UTC(2026, 11, 31)))).toBe(53);
  });
});

describe('describePeriod', () => {
  test('relativo: tiene la stringa come etichetta', () => {
    expect(describePeriod('Last month', 'Riferimento')).toMatchObject({ range: null, label: 'Last month' });
  });
  test('assente: usa l\'etichetta di riserva', () => {
    expect(describePeriod(undefined, 'Riferimento').label).toBe('Riferimento');
    expect(describePeriod('No filter', 'Riferimento').label).toBe('Riferimento');
  });
});

describe('shiftRange (stessa logica del filtro PeriodCompare)', () => {
  test('anno precedente con giorno limitato a fine mese', () => {
    expect(toTimeRangeString(shiftRange(r('2028-02-29 : 2028-03-01'), 'previous_year'))).toBe('2027-02-28 : 2027-03-01');
  });
  test('periodo precedente a mesi interi', () => {
    expect(toTimeRangeString(shiftRange(r('2026-10-01 : 2027-01-01'), 'previous_period'))).toBe('2026-07-01 : 2026-10-01');
  });
  test('periodo precedente di uguale durata', () => {
    expect(toTimeRangeString(shiftRange(r('2026-10-10 : 2026-10-17'), 'previous_period'))).toBe('2026-10-03 : 2026-10-10');
  });
});
