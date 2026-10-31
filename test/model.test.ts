import { buildModel, toSliceConfig } from '../src/utils/model';
import { mergePeriods } from '../src/utils/merge';
import { readRows, normalizeKey, isTruncated } from '../src/utils/rows';
import { parseNumber } from '../src/utils/format';

const colorFor = (key: string) => `color:${key}`;
const rows = (pairs: [string, number | null][]) => pairs.map(([key, value]) => ({ key, label: key, value }));

describe('mergePeriods: full join', () => {
  test('slices present in only one period are new or missing', () => {
    const m = mergePeriods(rows([['a', 10], ['b', 30]]), rows([['b', 20], ['c', 5]]));
    const byKey = Object.fromEntries(m.slices.map(s => [s.key, s]));
    expect(byKey.a).toMatchObject({ refValue: 10, cmpValue: 0, isNew: true, isGone: false });
    expect(byKey.c).toMatchObject({ refValue: 0, cmpValue: 5, isNew: false, isGone: true });
    expect(byKey.b).toMatchObject({ refValue: 30, cmpValue: 20, isNew: false, isGone: false });
  });

  test('shares and share change', () => {
    const m = mergePeriods(rows([['a', 10], ['b', 30]]), rows([['b', 20], ['c', 5]]));
    const b = m.slices.find(s => s.key === 'b')!;
    expect(b.refShare).toBeCloseTo(0.75);
    expect(b.cmpShare).toBeCloseTo(0.8);
    expect(b.deltaPts).toBeCloseTo(-5);
    expect(b.deltaPct).toBeCloseTo(50);
    expect(b.trend).toBe('up');
  });

  test('negative values are treated as zero and reported', () => {
    const m = mergePeriods(rows([['a', -5], ['b', 10]]), null);
    expect(m.negativeKeys).toEqual(['a']);
    expect(m.slices.find(s => s.key === 'a')!.refValue).toBe(0);
    expect(m.refTotal).toBe(10);
  });

  test('without comparison: no delta', () => {
    const m = mergePeriods(rows([['a', 1], ['b', 3]]), null);
    expect(m.hasComparison).toBe(false);
    expect(m.slices[0]).toMatchObject({ cmpValue: null, deltaPct: null, deltaPts: null });
  });
});

describe('mergePeriods: truncated periods', () => {
  test('key missing from a truncated period is unknown, not zero', () => {
    const m = mergePeriods(rows([['a', 10]]), rows([['b', 20]]), { refTruncated: true });
    const b = m.slices.find(s => s.key === 'b')!;
    expect(b.unknown).toBe('ref');
    expect(b.isGone).toBe(false);
    expect(b.deltaPct).toBeNull();
    const a = m.slices.find(s => s.key === 'a')!;
    expect(a.unknown).toBe('none');
    expect(a.isNew).toBe(true);
  });
});

describe('mergePeriods: Other and rest', () => {
  test('threshold: small slices grouped, shares consistent', () => {
    const m = mergePeriods(rows([['a', 90], ['b', 5], ['c', 3], ['d', 2]]), null, { otherThreshold: 10 });
    const other = m.slices.find(s => s.isOther)!;
    expect(other.key).toBe('__other__');
    expect(other.members).toEqual(['b', 'c', 'd']);
    expect(other.refValue).toBe(10);
    expect(other.refShare).toBeCloseTo(0.1);
    expect(m.slices.reduce((acc, s) => acc + s.refShare, 0)).toBeCloseTo(1, 9);
  });

  test('a single member below the threshold: no Other', () => {
    const m = mergePeriods(rows([['a', 95], ['b', 3], ['c', 2]]), null, { otherThreshold: 2.5 });
    expect(m.slices.some(s => s.isOther)).toBe(false);
  });

  test('top N: the first N stay, the rest goes to Other', () => {
    const m = mergePeriods(rows([['a', 40], ['b', 30], ['c', 20], ['d', 10]]), null, { otherTopN: 2 });
    expect(m.slices.filter(s => !s.isOther).map(s => s.key)).toEqual(['a', 'b']);
    expect(m.slices.find(s => s.isOther)!.refValue).toBe(30);
  });

  test('exact total larger than the sum: rest slice', () => {
    const m = mergePeriods(rows([['a', 50], ['b', 50]]), null, { refDenominator: 200 });
    const rest = m.slices.find(s => s.key === '__rest__')!;
    expect(rest.refValue).toBe(100);
    expect(rest.refShare).toBeCloseTo(0.5);
    expect(m.refTotal).toBe(200);
  });
});

describe('buildModel', () => {
  test('hidden slices leave before the join: shares are recalculated', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['a', 10], ['b', 30]]),
      cmp: null,
      sliceConfig: toSliceConfig({ b: { visible: false } }),
      colorFor,
      other: { mode: 'none' },
    });
    expect(m.slices.map(s => s.key)).toEqual(['a']);
    expect(m.slices[0].refShare).toBe(1);
    expect(m.hiddenCount).toBe(1);
  });

  test('custom name and color from the configuration', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['a', 10]]),
      cmp: null,
      sliceConfig: { a: { name: 'Successful', color: '#00ff00' } },
      colorFor,
      other: { mode: 'none' },
    });
    expect(m.slices[0]).toMatchObject({ label: 'Successful', color: '#00ff00' });
  });

  test('polarity "lower is better": a decrease is positive', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['failed', 5]]),
      cmp: rows([['failed', 10]]),
      sliceConfig: { failed: { polarity: 'lower_is_better' } },
      colorFor,
      other: { mode: 'none' },
    });
    expect(m.slices[0].trend).toBe('down');
    expect(m.slices[0].sentiment).toBe('positive');
  });

  test('neutral polarity does not color', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['a', 5]]),
      cmp: rows([['a', 10]]),
      defaultPolarity: 'neutral',
      colorFor,
      other: { mode: 'none' },
    });
    expect(m.slices[0].sentiment).toBe('neutral');
  });

  test('zero slices hidden on request and counted', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['a', 10], ['b', 0]]),
      cmp: rows([['a', 5], ['b', 0]]),
      hideZero: true,
      colorFor,
      other: { mode: 'none' },
    });
    expect(m.slices.map(s => s.key)).toEqual(['a']);
    expect(m.hiddenZeroCount).toBe(1);
  });

  test('Other color is grey', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['a', 90], ['b', 5], ['c', 5]]),
      cmp: null,
      colorFor,
      other: { mode: 'threshold', threshold: 10 },
    });
    expect(m.slices.find(s => s.isOther)!.color).toBe('#BFBFBF');
  });

  test('sorted by value, Other last', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['small', 1], ['large', 80], ['medium', 19]]),
      cmp: null,
      colorFor,
      other: { mode: 'threshold', threshold: 2 },
    });
    expect(m.slices.map(s => s.key)).toEqual(['large', 'medium', 'small']);
  });
});

describe('rows', () => {
  test('column mode: normalized key and numeric value', () => {
    const data = [{ status: 'Shipped', sum: '1.250,5' }, { status: null, sum: 3 }];
    const r = readRows(data, 'column', 'status', ['sum']);
    expect(r[0].key).toBe('Shipped');
    expect(r[1].key).toBe('<NULL>');
    expect(r[1].value).toBe(3);
  });

  test('metrics mode: one slice per metric', () => {
    const r = readRows([{ successful: 8, failed: 2 }], 'metrics', null, ['successful', 'failed']);
    expect(r.map(x => [x.key, x.value])).toEqual([['successful', 8], ['failed', 2]]);
  });

  test('normalizeKey and parseNumber', () => {
    expect(normalizeKey(true)).toBe('true');
    expect(parseNumber(' 7 ')).toBe(7);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('abc')).toBeNull();
  });

  test('truncation: rowcount equal to the limit', () => {
    expect(isTruncated({ rowcount: 100 }, 100)).toBe(true);
    expect(isTruncated({ rowcount: 99 }, 100)).toBe(false);
    expect(isTruncated(undefined, 100)).toBe(false);
  });
});

describe('colors', () => {
  test('adjacent slices have different colors, even with colliding keys', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['boy', 30], ['girl', 20], ['x', 10]]),
      cmp: null,
      colorFor: (key, index) => ['#111', '#222', '#333'][index % 3] + key.length * 0,
      other: { mode: 'none' },
    });
    const colors = m.slices.map(s => s.color.slice(0, 4));
    expect(new Set(colors).size).toBe(3);
  });
});
