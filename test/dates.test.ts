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
  test('PeriodCompare filter separator', () => {
    const range = r('2026-10-01 : 2026-11-01');
    expect(range.start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
  test('ISO dates with time and compact separator', () => {
    expect(parseTimeRange('2026-10-01T00:00:00:2026-10-08T00:00:00')).not.toBeNull();
  });
  test.each(['Last month', 'No filter', '', 'previous calendar year', '2026-11-01 : 2026-10-01'])(
    'not parseable or relative: %s',
    raw => expect(parseTimeRange(raw)).toBeNull(),
  );
});

describe('detectGranularity and labelForRange', () => {
  test.each([
    ['2026-01-01 : 2027-01-01', 'year', '2026'],
    ['2026-10-01 : 2027-01-01', 'quarter', 'Q4 2026'],
    ['2026-10-01 : 2026-11-01', 'month', 'Oct 2026'],
    ['2026-10-12 : 2026-10-19', 'week', 'Wk 42 2026'],
    ['2026-10-15 : 2026-10-16', 'day', '2026-10-15'],
    ['2026-10-01 : 2026-10-16', 'custom', '2026-10-01 - 2026-10-15'],
  ])('%s -> %s (%s)', (raw, gran, label) => {
    expect(detectGranularity(r(raw))).toBe(gran);
    expect(labelForRange(r(raw))).toBe(label);
  });
  test('long month', () => {
    expect(labelForRange(r('2026-10-01 : 2026-11-01'), 'long')).toBe('October 2026');
  });
  test('ISO week across a year boundary', () => {
    expect(isoWeek(new Date(Date.UTC(2026, 11, 31)))).toBe(53);
  });
});

describe('describePeriod', () => {
  test('relative: keeps the string as label', () => {
    expect(describePeriod('Last month', 'Reference')).toMatchObject({ range: null, label: 'Last month' });
  });
  test('missing: uses the fallback label', () => {
    expect(describePeriod(undefined, 'Reference').label).toBe('Reference');
    expect(describePeriod('No filter', 'Reference').label).toBe('Reference');
  });
});

describe('shiftRange (same logic as the PeriodCompare filter)', () => {
  test('previous year, day clamped to month end', () => {
    expect(toTimeRangeString(shiftRange(r('2028-02-29 : 2028-03-01'), 'previous_year'))).toBe('2027-02-28 : 2027-03-01');
  });
  test('previous period on whole months', () => {
    expect(toTimeRangeString(shiftRange(r('2026-10-01 : 2027-01-01'), 'previous_period'))).toBe('2026-07-01 : 2026-10-01');
  });
  test('previous period of equal length', () => {
    expect(toTimeRangeString(shiftRange(r('2026-10-10 : 2026-10-17'), 'previous_period'))).toBe('2026-10-03 : 2026-10-10');
  });
});
