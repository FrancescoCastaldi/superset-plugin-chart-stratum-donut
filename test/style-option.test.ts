import { applyTheme, readStyle } from '../src/utils/style';
import { buildDonutOption, escapeHtml, labelText, ringRadii, tooltipHtml, centerText } from '../src/utils/echartsOption';
import { buildModel } from '../src/utils/model';
import { mergePeriods } from '../src/utils/merge';

const colorFor = (k: string) => `c:${k}`;
const rows = (pairs: [string, number][]) => pairs.map(([key, value]) => ({ key, label: key, value }));

describe('readStyle', () => {
  test('default values', () => {
    const s = readStyle({});
    expect(s).toMatchObject({ outerRadius: 70, ringWidth: 25, ringGap: 3, labelContent: 'name_percent', centerContent: 'ref_total_delta', centerCaption: 'Total' });
    expect(s.tooltipItems).toEqual(['values', 'shares', 'delta_pct', 'delta_pts']);
    expect(s.legendColumns).toEqual(['value', 'share', 'delta']);
  });
  test('non-numeric values fall back to the default', () => {
    expect(readStyle({ dc_outer_radius: 'abc' }).outerRadius).toBe(70);
  });
  test('legend at the bottom only when explicitly requested', () => {
    expect(readStyle({}).legendPosition).toBe('right');
    expect(readStyle({ dc_legend_position: 'bottom' }).legendPosition).toBe('bottom');
    expect(readStyle({ dc_legend_position: 'left' }).legendPosition).toBe('right');
  });
});

describe('theme', () => {
  test('theme colors applied, fallback when missing', () => {
    const base = readStyle({});
    expect(applyTheme(base, { colorText: '#eee', colorBgContainer: '#111' })).toMatchObject({ textColor: '#eee', borderColor: '#111' });
    expect(applyTheme(base, undefined)).toMatchObject({ textColor: '#1f2933', borderColor: '#ffffff' });
  });
  test('label text follows the theme', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3], ['b', 1]]), cmp: null, colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, applyTheme(readStyle({}), { colorText: '#e6e8eb' }), { refLabel: 'R', cmpLabel: null });
    expect(opt.series[0].data[0].label.color).toBe('#e6e8eb');
  });
});

describe('ringRadii', () => {
  test('single ring', () => {
    const r = ringRadii(readStyle({}), false);
    expect(r.outer).toEqual(['45%', '70%']);
  });
  test('double ring: outer above, inner below the gap', () => {
    const r = ringRadii(readStyle({}), true);
    expect(r.outer).toEqual(['45%', '70%']);
    expect(r.inner).toEqual(['17%', '42%']);
  });
  test('the inner ring does not go below zero', () => {
    const r = ringRadii(readStyle({ dc_ring_width: 40, dc_inner_ring_width: 40, dc_ring_gap: 15 }), true);
    expect(r.inner[0]).toBe('0%');
  });
});

describe('text and tooltip', () => {
  const model = buildModel({
    mode: 'column',
    ref: rows([['Successful', 80], ['Failed', 20]]),
    cmp: rows([['Successful', 60], ['Failed', 40]]),
    colorFor,
    other: { mode: 'none' },
  });

  test('HTML escape of names', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });

  test('label: name and percentage', () => {
    const s = model.slices.find(x => x.key === 'Successful')!;
    expect(labelText(s, readStyle({}), true)).toBe('Successful\n80.0%');
  });

  test('label: percentage with point change and arrow', () => {
    const s = model.slices.find(x => x.key === 'Successful')!;
    const text = labelText(s, readStyle({ dc_label_content: 'percent_delta' }), true);
    expect(text).toBe('80.0% ▲ +20.0 pt');
  });

  test('tooltip: values, shares and chosen deltas, names escaped', () => {
    const s = model.slices.find(x => x.key === 'Successful')!;
    const html = tooltipHtml(s, readStyle({}), { refLabel: 'Oct 2026', cmpLabel: 'Oct 2025' }, true);
    expect(html).toContain('Oct 2026: 80');
    expect(html).toContain('Oct 2025: 60');
    expect(html).toContain('Change: +33.3%');
    expect(html).toContain('Share change: +20.0 pt');
  });

  test('center text with the change on the total', () => {
    expect(centerText(model, readStyle({}))).toBe('Total\n100\n0.0%');
    expect(centerText(model, readStyle({ dc_center_content: 'none' }))).toBeNull();
  });
});

describe('buildDonutOption', () => {
  test('two concentric series with comparison, one with reference only', () => {
    const model = buildModel({
      mode: 'column',
      ref: rows([['a', 3], ['b', 1]]),
      cmp: rows([['a', 2], ['b', 2]]),
      colorFor,
      other: { mode: 'none' },
    });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'Reference', cmpLabel: 'Comparison' });
    expect(opt.series).toHaveLength(2);
    expect(opt.series[0].data.map((d: any) => d.value)).toEqual([3, 1]);
    expect(opt.series[1].data[0].itemStyle.opacity).toBe(0.55);

    const single = buildDonutOption(buildModel({ mode: 'column', ref: rows([['a', 3]]), cmp: null, colorFor, other: { mode: 'none' } }), readStyle({}), { refLabel: 'R', cmpLabel: null });
    expect(single.series).toHaveLength(1);
  });

  test('slice color shared by both rings', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3]]), cmp: rows([['a', 2]]), colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'R', cmpLabel: 'C' });
    expect(opt.series[0].data[0].itemStyle.color).toBe('c:a');
    expect(opt.series[1].data[0].itemStyle.color).toBe('c:a');
  });

  test('solid style: no transparency on the comparison ring', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3]]), cmp: rows([['a', 2]]), colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({ dc_cmp_style: 'solid' }), { refLabel: 'R', cmpLabel: 'C' });
    expect(opt.series[1].data[0].itemStyle.opacity).toBe(1);
  });

  test('slices with a share below the threshold have no label', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 98], ['b', 2]]), cmp: null, colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({ dc_label_min_share: 5 }), { refLabel: 'R', cmpLabel: null });
    expect(opt.series[0].data[1].label.show).toBe(false);
    expect(opt.series[0].data[0].label.show).toBe(true);
  });

  test('tooltip returns the HTML of the right slice', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3], ['b', 1]]), cmp: null, colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'R', cmpLabel: null });
    expect(opt.tooltip.formatter({ dataIndex: 1 })).toContain('<strong>b</strong>');
  });

  test('merge exported for import safety', () => {
    expect(typeof mergePeriods).toBe('function');
  });
});

describe('selection', () => {
  test('with a selection the other slices fade on both rings', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3], ['b', 1]]), cmp: rows([['a', 2], ['b', 2]]), colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'R', cmpLabel: 'C' }, ['a']);
    expect(opt.series[0].data[0].itemStyle.opacity).toBe(1);
    expect(opt.series[0].data[1].itemStyle.opacity).toBe(0.3);
    expect(opt.series[1].data[1].itemStyle.opacity).toBe(0.3);
  });
  test('without a selection no fading', () => {
    const model = buildModel({ mode: 'column', ref: rows([['a', 3], ['b', 1]]), cmp: null, colorFor, other: { mode: 'none' } });
    const opt = buildDonutOption(model, readStyle({}), { refLabel: 'R', cmpLabel: null });
    expect(opt.series[0].data[1].itemStyle.opacity).toBe(1);
  });
});
