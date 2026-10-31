import { DonutModel, SliceModel } from './model';
import { OptionStyle } from './style';
import { formatDeltaPct, formatNumber, formatPercent, formatPts, formatSignedNumber, trendArrow } from './format';

export interface SeriesLabels {
  refLabel: string;
  cmpLabel: string | null;
}

/** HTML escape: slice names come from the data and are not trusted. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const MIN_INNER_RADIUS = 8;

/** Radii as a percentage of the container's half-size. Outer ring = reference. */
export function ringRadii(style: OptionStyle, comparison: boolean): { outer: [string, string]; inner: [string, string] } {
  const o = style.outerRadius;
  const w = style.ringWidth;
  if (!comparison) {
    return { outer: [`${Math.max(0, o - w)}%`, `${o}%`], inner: ['0%', '0%'] };
  }
  const innerW = style.innerRingWidth > 0 ? style.innerRingWidth : w;
  const outerInner = Math.max(MIN_INNER_RADIUS, o - w);
  const innerOuter = Math.max(0, outerInner - style.ringGap);
  const innerInner = Math.max(0, innerOuter - innerW);
  return { outer: [`${outerInner}%`, `${o}%`], inner: [`${innerInner}%`, `${innerOuter}%`] };
}

/** Text of a slice's label, according to the user's choice. */
export function labelText(s: SliceModel, style: OptionStyle, comparison: boolean): string {
  const pct = formatPercent(s.refShare, 1);
  const value = formatNumber(s.refValue, 0);
  const pts = formatPts(s.deltaPts, style.deltaDecimals);
  const arrow = trendArrow(s.trendShare, style.deltaArrows);
  switch (style.labelContent) {
    case 'percent':
      return pct;
    case 'value':
      return value;
    case 'value_percent':
      return `${value} · ${pct}`;
    case 'name_value_percent':
      return `${s.label}\n${value} · ${pct}`;
    case 'percent_delta':
      return comparison && s.deltaPts !== null ? `${pct} ${arrow} ${pts}` : pct;
    default:
      return `${s.label}\n${pct}`;
  }
}

/** Tooltip text, with the values of both periods and the chosen deltas. */
export function tooltipHtml(s: SliceModel, style: OptionStyle, labels: SeriesLabels, comparison: boolean): string {
  const rows: string[] = [`<strong>${escapeHtml(s.label)}</strong>`];
  const has = (item: string) => style.tooltipItems.includes(item as any);
  if (has('values')) {
    rows.push(`${escapeHtml(labels.refLabel)}: ${formatNumber(s.refValue, 0)}`);
    if (comparison && labels.cmpLabel) rows.push(`${escapeHtml(labels.cmpLabel)}: ${formatNumber(s.cmpValue, 0)}`);
  }
  if (has('shares')) {
    rows.push(`Share: ${formatPercent(s.refShare, 1)}${comparison ? ` / ${formatPercent(s.cmpShare, 1)}` : ''}`);
  }
  if (comparison) {
    if (has('delta_abs')) rows.push(`Difference: ${formatSignedNumber(s.deltaAbs ?? 0, 0)}`);
    if (has('delta_pct')) rows.push(`Change: ${formatDeltaPct(s.deltaPct, style.deltaDecimals)}`);
    if (has('delta_pts')) rows.push(`Share change: ${formatPts(s.deltaPts, style.deltaDecimals)}`);
  }
  return rows.join('<br/>');
}

/** Center text: the reference total, optionally with the change on the total. */
export function centerText(model: DonutModel, style: OptionStyle): string | null {
  if (style.centerContent === 'none') return null;
  const total = formatNumber(model.refTotal, 0);
  if (style.centerContent === 'ref_total' || !model.hasComparison || model.cmpTotal === null) {
    return `${style.centerCaption}\n${total}`;
  }
  const delta = model.cmpTotal !== 0 ? ((model.refTotal - model.cmpTotal) / Math.abs(model.cmpTotal)) * 100 : null;
  return `${style.centerCaption}\n${total}\n${formatDeltaPct(delta, style.deltaDecimals)}`;
}

/** Full ECharts option: two concentric pie series, no built-in legend. */
export function buildDonutOption(
  model: DonutModel,
  style: OptionStyle,
  labels: SeriesLabels,
  selectedKeys: string[] = [],
): Record<string, any> {
  const comparison = model.hasComparison;
  const radii = ringRadii(style, comparison);
  const cmpOpacity = style.cmpStyle === 'faded' ? 0.55 : 1;
  // With an active selection, the unselected slices fade on both rings.
  const dim = (key: string) => selectedKeys.length > 0 && !selectedKeys.includes(key);
  const showLabel = (ring: 'outer' | 'inner') =>
    style.labelRings === 'both' || (style.labelRings === 'outer' && ring === 'outer');
  const itemLabel = (s: SliceModel, ring: 'outer' | 'inner') => {
    const visible = showLabel(ring) && (s.refShare * 100 >= style.labelMinShare || ring === 'inner');
    return {
      show: visible,
      position: style.labelPosition,
      color: style.textColor,
      formatter: () => (ring === 'outer' ? labelText(s, style, comparison) : formatPercent(s.cmpShare, 1)),
    };
  };
  const base = {
    type: 'pie',
    center: ['50%', '50%'],
    startAngle: style.startAngle,
    clockwise: true,
    avoidLabelOverlap: true,
    itemStyle: { borderRadius: 4, borderColor: style.borderColor, borderWidth: 1 },
    labelLine: { show: style.labelPosition === 'outside', lineStyle: { color: style.textColor } },
  };

  const series: Record<string, any>[] = [
    {
      ...base,
      name: labels.refLabel,
      radius: radii.outer,
      label: { show: style.labelRings !== 'none' },
      data: model.slices.map(s => ({
        name: s.label,
        value: s.refValue,
        itemStyle: { color: s.color, opacity: dim(s.key) ? 0.3 : 1 },
        label: itemLabel(s, 'outer'),
        key: s.key,
      })),
    },
  ];
  if (comparison) {
    series.push({
      ...base,
      name: labels.cmpLabel ?? '',
      radius: radii.inner,
      label: { show: style.labelRings === 'both' },
      data: model.slices.map(s => ({
        name: s.label,
        value: s.cmpValue ?? 0,
        itemStyle: { color: s.color, opacity: dim(s.key) ? 0.3 : cmpOpacity },
        label: itemLabel(s, 'inner'),
        key: s.key,
      })),
    });
  }

  const text = centerText(model, style);
  return {
    animation: true,
    tooltip: {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const slice = model.slices[p.dataIndex];
        return slice ? tooltipHtml(slice, style, labels, comparison) : '';
      },
    },
    graphic: text
      ? [{ type: 'text', left: 'center', top: 'middle', style: { text, align: 'center', fill: style.textColor, fontSize: 14, fontWeight: 600 } }]
      : [],
    series,
  };
}
