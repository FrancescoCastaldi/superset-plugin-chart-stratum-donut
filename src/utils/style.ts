import { ArrowStyle } from './format';

export type LabelContent = 'percent' | 'value' | 'value_percent' | 'name_percent' | 'name_value_percent' | 'percent_delta';
export type CenterContent = 'ref_total_delta' | 'ref_total' | 'none';
export type LegendColumn = 'value' | 'share' | 'delta';
export type TooltipItem = 'values' | 'shares' | 'delta_abs' | 'delta_pct' | 'delta_pts';

/** Visual settings of the donut, read from the Customize panel. */
export interface OptionStyle {
  outerRadius: number;
  ringWidth: number;
  innerRingWidth: number;
  ringGap: number;
  startAngle: number;
  cmpStyle: 'solid' | 'faded';
  labelRings: 'outer' | 'both' | 'none';
  labelContent: LabelContent;
  labelPosition: 'outside' | 'inside';
  labelMinShare: number;
  centerContent: CenterContent;
  centerCaption: string;
  tooltipItems: TooltipItem[];
  deltaArrows: ArrowStyle;
  deltaDecimals: number;
  legendShow: boolean;
  legendPosition: 'right' | 'bottom';
  legendColumns: LegendColumn[];
  defaultPolarity: 'higher_is_better' | 'lower_is_better' | 'neutral';
  /** Theme colors: text and labels, background for the slice borders. */
  textColor: string;
  borderColor: string;
}

const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Reads the settings from formData, with the panel's default values. */
export function readStyle(fd: Record<string, any>): OptionStyle {
  return {
    outerRadius: num(fd.dc_outer_radius, 70),
    ringWidth: num(fd.dc_ring_width, 25),
    innerRingWidth: num(fd.dc_inner_ring_width, 0),
    ringGap: num(fd.dc_ring_gap, 3),
    startAngle: num(fd.dc_start_angle, 90),
    cmpStyle: fd.dc_cmp_style === 'solid' ? 'solid' : 'faded',
    labelRings: fd.dc_label_rings ?? 'outer',
    labelContent: fd.dc_label_content ?? 'name_percent',
    labelPosition: fd.dc_label_position ?? 'outside',
    labelMinShare: num(fd.dc_label_min_share, 3),
    centerContent: fd.dc_center_content ?? 'ref_total_delta',
    centerCaption: fd.dc_center_caption || 'Total',
    tooltipItems: Array.isArray(fd.dc_tooltip_items)
      ? fd.dc_tooltip_items
      : ['values', 'shares', 'delta_pct', 'delta_pts'],
    deltaArrows: fd.dc_delta_arrows ?? 'triangle',
    deltaDecimals: num(fd.dc_delta_decimals, 1),
    legendShow: fd.dc_legend_show ?? true,
    legendPosition: fd.dc_legend_position === 'bottom' ? 'bottom' : 'right',
    legendColumns: Array.isArray(fd.dc_legend_columns) ? fd.dc_legend_columns : ['value', 'share', 'delta'],
    defaultPolarity: fd.dc_default_polarity ?? 'higher_is_better',
    textColor: '#1f2933',
    borderColor: '#ffffff',
  };
}

/** Applies the Superset theme colors (colorText, colorBgContainer), when present. */
export function applyTheme(style: OptionStyle, theme: Record<string, any> | undefined | null): OptionStyle {
  return {
    ...style,
    textColor: typeof theme?.colorText === 'string' ? theme.colorText : style.textColor,
    borderColor: typeof theme?.colorBgContainer === 'string' ? theme.colorBgContainer : style.borderColor,
  };
}
