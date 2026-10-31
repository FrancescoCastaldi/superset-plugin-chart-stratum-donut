import { applyTheme, readStyle } from '../src/utils/style';
import { buildDonutOption, escapeHtml, labelText, ringRadii, tooltipHtml, centerText } from '../src/utils/echartsOption';
import { buildModel } from '../src/utils/model';
import { mergePeriods } from '../src/utils/merge';

const colorFor = (k: string) => `c:${k}`;
const rows = (pairs: [string, number][]) => pairs.map(([key, value]) => ({ key, label: key, value }));

describe('readStyle', () => {
  test('valori predefiniti', () => {
    const s = readStyle({});
    expect(s).toMatchObject({ outerRadius: 70, ringWidth: 25, ringGap: 3, labelContent: 'name_percent', centerContent: 'ref_total_delta', centerCaption: 'Totale' });
    expect(s.tooltipItems).toEqual(['values', 'shares', 'delta_pct', 'delta_pts']);
    expect(s.legendColumns).toEqual(['value', 'share', 'delta']);
  });
  test('valori non numerici ricadono sul predefinito', () => {
    expect(readStyle({ dc_outer_radius: 'abc' }).outerRadius).toBe(70);
  });
  test('legenda in basso solo se richiesto esplicitamente', () => {
    expect(readStyle({}).legendPosition).toBe('right');
    expect(readStyle({ dc_legend_position: 'bottom' }).legendPosition).toBe('bottom');
    expect(readStyle({ dc_legend_position: 'left' }).legendPosition).toBe('right');
  });
});

describe('tema', () => {
  test('colori del tema applicati, riserva se assenti', () => {
    const base = readStyle({});
    expect(applyTheme(base, { colorText: '#eee', colorBgContainer: '#111' })).toMatchObject({ textColor: '#eee', borderColor: '#111' });
    expect(applyTheme(base, undefined)).toMatchObject({ textColor: '#1f2933', borderColor: '#ffffff' });
  });
  test('il testo delle etichette segue il tema', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3], ['b', 1]]), cmp: null, colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, applyTheme(readStyle({}), { colorText: '#e6e8eb' }), { refLabel: 'R', cmpLabel: null });
    expect(opt.series[0].data[0].label.color).toBe('#e6e8eb');
  });
});

describe('ringRadii', () => {
  test('singolo anello', () => {
    const r = ringRadii(readStyle({}), false);
    expect(r.outer).toEqual(['45%', '70%']);
  });
  test('doppio anello: esterno sopra, interno sotto il gap', () => {
    const r = ringRadii(readStyle({}), true);
    expect(r.outer).toEqual(['45%', '70%']);
    expect(r.inner).toEqual(['17%', '42%']);
  });
  test('l\'anello interno non scende sotto zero', () => {
    const r = ringRadii(readStyle({ dc_ring_width: 40, dc_inner_ring_width: 40, dc_ring_gap: 15 }), true);
    expect(r.inner[0]).toBe('0%');
  });
});

describe('testo e tooltip', () => {
  const model = buildModel({
    mode: 'column',
    ref: rows([['Riuscite', 80], ['Fallite', 20]]),
    cmp: rows([['Riuscite', 60], ['Fallite', 40]]),
    colorFor,
    other: { mode: 'none' },
  });

  test('escape HTML dei nomi', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });

  test('etichetta: nome e percentuale', () => {
    const s = model.slices.find(x => x.key === 'Riuscite')!;
    expect(labelText(s, readStyle({}), true)).toBe('Riuscite\n80,0%');
  });

  test('etichetta: percentuale con delta in punti e freccia', () => {
    const s = model.slices.find(x => x.key === 'Riuscite')!;
    const text = labelText(s, readStyle({ dc_label_content: 'percent_delta' }), true);
    expect(text).toBe('80,0% ▲ +20,0 pt');
  });

  test('tooltip: valori, quote e delta scelti, nomi escapati', () => {
    const s = model.slices.find(x => x.key === 'Riuscite')!;
    const html = tooltipHtml(s, readStyle({}), { refLabel: 'Ott 2026', cmpLabel: 'Ott 2025' }, true);
    expect(html).toContain('Ott 2026: 80');
    expect(html).toContain('Ott 2025: 60');
    expect(html).toContain('Variazione: +33,3%');
    expect(html).toContain('Variazione quota: +20,0 pt');
  });

  test('testo centrale con variazione del totale', () => {
    expect(centerText(model, readStyle({}))).toBe('Totale\n100\n0,0%');
    expect(centerText(model, readStyle({ dc_center_content: 'none' }))).toBeNull();
  });
});

describe('buildDonutOption', () => {
  test('due serie concentriche con confronto, una con solo riferimento', () => {
    const model = buildModel({
      mode: 'column',
      ref: rows([['a', 3], ['b', 1]]),
      cmp: rows([['a', 2], ['b', 2]]),
      colorFor,
      other: { mode: 'none' },
    });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'Riferimento', cmpLabel: 'Confronto' });
    expect(opt.series).toHaveLength(2);
    expect(opt.series[0].data.map((d: any) => d.value)).toEqual([3, 1]);
    expect(opt.series[1].data[0].itemStyle.opacity).toBe(0.55);

    const single = buildDonutOption(buildModel({ mode: 'column', ref: rows([['a', 3]]), cmp: null, colorFor, other: { mode: 'none' } }), readStyle({}), { refLabel: 'R', cmpLabel: null });
    expect(single.series).toHaveLength(1);
  });

  test('colore della fetta condiviso dai due anelli', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3]]), cmp: rows([['a', 2]]), colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'R', cmpLabel: 'C' });
    expect(opt.series[0].data[0].itemStyle.color).toBe('c:a');
    expect(opt.series[1].data[0].itemStyle.color).toBe('c:a');
  });

  test('stile solido: nessuna trasparenza sull\'anello di confronto', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3]]), cmp: rows([['a', 2]]), colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({ dc_cmp_style: 'solid' }), { refLabel: 'R', cmpLabel: 'C' });
    expect(opt.series[1].data[0].itemStyle.opacity).toBe(1);
  });

  test('fette con quota sotto soglia senza etichetta', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 98], ['b', 2]]), cmp: null, colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({ dc_label_min_share: 5 }), { refLabel: 'R', cmpLabel: null });
    expect(opt.series[0].data[1].label.show).toBe(false);
    expect(opt.series[0].data[0].label.show).toBe(true);
  });

  test('tooltip ritorna HTML della fetta corretta', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3], ['b', 1]]), cmp: null, colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'R', cmpLabel: null });
    expect(opt.tooltip.formatter({ dataIndex: 1 })).toContain('<strong>b</strong>');
  });

  test('merge esposto per sicurezza di import', () => {
    expect(typeof mergePeriods).toBe('function');
  });
});

describe('selezione', () => {
  test('con una selezione le altre fette si attenuano su entrambi gli anelli', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3], ['b', 1]]), cmp: rows([['a', 2], ['b', 2]]), colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'R', cmpLabel: 'C' }, ['a']);
    expect(opt.series[0].data[0].itemStyle.opacity).toBe(1);
    expect(opt.series[0].data[1].itemStyle.opacity).toBe(0.3);
    expect(opt.series[1].data[1].itemStyle.opacity).toBe(0.3);
  });
  test('senza selezione nessuna attenuazione', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3], ['b', 1]]), cmp: null, colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'R', cmpLabel: null });
    expect(opt.series[0].data[1].itemStyle.opacity).toBe(1);
  });
});
