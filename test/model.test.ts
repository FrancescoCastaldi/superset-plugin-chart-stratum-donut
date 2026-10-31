import { buildModel, toSliceConfig } from '../src/utils/model';
import { mergePeriods } from '../src/utils/merge';
import { readRows, normalizeKey, isTruncated } from '../src/utils/rows';
import { parseNumber } from '../src/utils/format';

const colorFor = (key: string) => `color:${key}`;
const rows = (pairs: [string, number | null][]) => pairs.map(([key, value]) => ({ key, label: key, value }));

describe('mergePeriods: join completo', () => {
  test('fette presenti in un solo periodo sono nuove o scomparse', () => {
    const m = mergePeriods(rows([['a', 10], ['b', 30]]), rows([['b', 20], ['c', 5]]));
    const byKey = Object.fromEntries(m.slices.map(s => [s.key, s]));
    expect(byKey.a).toMatchObject({ refValue: 10, cmpValue: 0, isNew: true, isGone: false });
    expect(byKey.c).toMatchObject({ refValue: 0, cmpValue: 5, isNew: false, isGone: true });
    expect(byKey.b).toMatchObject({ refValue: 30, cmpValue: 20, isNew: false, isGone: false });
  });

  test('quote e variazione della quota', () => {
    const m = mergePeriods(rows([['a', 10], ['b', 30]]), rows([['b', 20], ['c', 5]]));
    const b = m.slices.find(s => s.key === 'b')!;
    expect(b.refShare).toBeCloseTo(0.75);
    expect(b.cmpShare).toBeCloseTo(0.8);
    expect(b.deltaPts).toBeCloseTo(-5);
    expect(b.deltaPct).toBeCloseTo(50);
    expect(b.trend).toBe('up');
  });

  test('valori negativi trattati come zero e segnalati', () => {
    const m = mergePeriods(rows([['a', -5], ['b', 10]]), null);
    expect(m.negativeKeys).toEqual(['a']);
    expect(m.slices.find(s => s.key === 'a')!.refValue).toBe(0);
    expect(m.refTotal).toBe(10);
  });

  test('senza confronto: nessun delta', () => {
    const m = mergePeriods(rows([['a', 1], ['b', 3]]), null);
    expect(m.hasComparison).toBe(false);
    expect(m.slices[0]).toMatchObject({ cmpValue: null, deltaPct: null, deltaPts: null });
  });
});

describe('mergePeriods: periodi troncati', () => {
  test('chiave assente da un periodo troncato e sconosciuta, non zero', () => {
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

describe('mergePeriods: Altro e rest', () => {
  test('soglia: fette piccole raggruppate, quote coerenti', () => {
    const m = mergePeriods(rows([['a', 90], ['b', 5], ['c', 3], ['d', 2]]), null, { otherThreshold: 10 });
    const other = m.slices.find(s => s.isOther)!;
    expect(other.key).toBe('__other__');
    expect(other.members).toEqual(['b', 'c', 'd']);
    expect(other.refValue).toBe(10);
    expect(other.refShare).toBeCloseTo(0.1);
    expect(m.slices.reduce((acc, s) => acc + s.refShare, 0)).toBeCloseTo(1, 9);
  });

  test('un solo membro sotto soglia: nessun Altro', () => {
    const m = mergePeriods(rows([['a', 95], ['b', 3], ['c', 2]]), null, { otherThreshold: 2.5 });
    expect(m.slices.some(s => s.isOther)).toBe(false);
  });

  test('top N: le prime N restano, il resto va in Altro', () => {
    const m = mergePeriods(rows([['a', 40], ['b', 30], ['c', 20], ['d', 10]]), null, { otherTopN: 2 });
    expect(m.slices.filter(s => !s.isOther).map(s => s.key)).toEqual(['a', 'b']);
    expect(m.slices.find(s => s.isOther)!.refValue).toBe(30);
  });

  test('totale esatto maggiore della somma: fetta rest', () => {
    const m = mergePeriods(rows([['a', 50], ['b', 50]]), null, { refDenominator: 200 });
    const rest = m.slices.find(s => s.key === '__rest__')!;
    expect(rest.refValue).toBe(100);
    expect(rest.refShare).toBeCloseTo(0.5);
    expect(m.refTotal).toBe(200);
  });
});

describe('buildModel', () => {
  test('fette nascoste escono prima del join: le quote si ricalcolano', () => {
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

  test('nome personalizzato e colore dalla configurazione', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['a', 10]]),
      cmp: null,
      sliceConfig: { a: { name: 'Riuscite', color: '#00ff00' } },
      colorFor,
      other: { mode: 'none' },
    });
    expect(m.slices[0]).toMatchObject({ label: 'Riuscite', color: '#00ff00' });
  });

  test('polarita\' "meglio se minore": una diminuzione e\' positiva', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['fallite', 5]]),
      cmp: rows([['fallite', 10]]),
      sliceConfig: { fallite: { polarity: 'lower_is_better' } },
      colorFor,
      other: { mode: 'none' },
    });
    expect(m.slices[0].trend).toBe('down');
    expect(m.slices[0].sentiment).toBe('positive');
  });

  test('polarita\' neutra non colora', () => {
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

  test('fette a zero nascoste su richiesta e contate', () => {
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

  test('colore di Altro grigio', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['a', 90], ['b', 5], ['c', 5]]),
      cmp: null,
      colorFor,
      other: { mode: 'threshold', threshold: 10 },
    });
    expect(m.slices.find(s => s.isOther)!.color).toBe('#BFBFBF');
  });

  test('ordinamento per valore, Altro in fondo', () => {
    const m = buildModel({
      mode: 'column',
      ref: rows([['piccola', 1], ['grande', 80], ['media', 19]]),
      cmp: null,
      colorFor,
      other: { mode: 'threshold', threshold: 2 },
    });
    expect(m.slices.map(s => s.key)).toEqual(['grande', 'media', 'piccola']);
  });
});

describe('rows', () => {
  test('modalita\' colonna: chiave normalizzata e valore numerico', () => {
    const data = [{ status: 'Shipped', sum: '1.250,5' }, { status: null, sum: 3 }];
    const r = readRows(data, 'column', 'status', ['sum']);
    expect(r[0].key).toBe('Shipped');
    expect(r[1].key).toBe('<NULL>');
    expect(r[1].value).toBe(3);
  });

  test('modalita\' metriche: una fetta per metrica', () => {
    const r = readRows([{ riuscite: 8, fallite: 2 }], 'metrics', null, ['riuscite', 'fallite']);
    expect(r.map(x => [x.key, x.value])).toEqual([['riuscite', 8], ['fallite', 2]]);
  });

  test('normalizeKey e parseNumber', () => {
    expect(normalizeKey(true)).toBe('true');
    expect(parseNumber(' 7 ')).toBe(7);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('abc')).toBeNull();
  });

  test('troncamento: rowcount uguale al limite', () => {
    expect(isTruncated({ rowcount: 100 }, 100)).toBe(true);
    expect(isTruncated({ rowcount: 99 }, 100)).toBe(false);
    expect(isTruncated(undefined, 100)).toBe(false);
  });
});

describe('colori', () => {
  test('fette adiacenti hanno colori diversi, anche con chiavi che collidono', () => {
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

