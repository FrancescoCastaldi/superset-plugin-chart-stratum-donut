import type { ChartProps } from '@superset-ui/core';
import { ComparisonPlan, resolveComparison } from '../utils/comparison';
import { guardComparison, planQueries } from './queryPlan';
import { buildModel, DonutModel, toSliceConfig } from '../utils/model';
import { columnNameOf, isTruncated, metricLabelOf, readRows } from '../utils/rows';
import { parseNumber } from '../utils/format';
import { periodFromBounds } from '../utils/periodLabel';
import { readDashboardPeriods } from '../utils/dashboardPeriods';
import { paletteColor } from '../utils/palette';
import { PeriodInfo, SliceSort } from '../types';
import { MonthStyle } from '../utils/dates';
import { applyTheme, OptionStyle, readStyle } from '../utils/style';

type Fd = Record<string, any>;

export interface Notice {
  level: 'info' | 'warning';
  text: string;
}

/** Hint shown when the shares depend on a row limit. */
const EXACT_HINT = 'For the real total, enable "Exact total" in the Data section (column mode only).';

const INACTIVE_TEXT: Record<string, string> = {
  no_dashboard_comparison: 'The dashboard filter has no active comparison.',
  no_reference_range: 'Comparison not available: the reference period needs a start and an end date.',
  unsupported_relative: 'Previous period cannot be computed for this expression: use an explicit range or a preset (e.g. Previous year).',
  no_temporal_column: 'Comparison not available: the chart has no time column.',
};

/** Dashboard interactions: cross-filter and context menu. */
export interface Interaction {
  /** Filterable column: column mode only. */
  column: string | null;
  /** Keys of the selected slices (filter state). */
  selectedKeys: string[];
  /** The chart emits cross-filters (set in the dashboard). */
  emit: boolean;
  setDataMask?: (mask: any) => void;
  onContextMenu?: (x: number, y: number, payload: any) => void;
}

export interface TransformedProps {
  width: number;
  height: number;
  mode: 'column' | 'metrics';
  model: DonutModel;
  comparison: ComparisonPlan;
  comparisonActive: boolean;
  comparisonType: string | null;
  periods: { ref: PeriodInfo; cmp: PeriodInfo | null; refLabel: string; cmpLabel: string | null; header: string };
  notices: Notice[];
  style: OptionStyle;
  interaction: Interaction;
}

function temporalFilterValue(fd: Fd): string | null {
  const f = (fd.adhoc_filters ?? []).find((x: any) => x?.operator === 'TEMPORAL_RANGE');
  return f?.comparator ?? null;
}

/** Sort chosen in the panel, translated into the merge sort. */
function mapSort(sort: string | undefined, mode: 'column' | 'metrics'): SliceSort {
  if (sort === 'ref_asc') return 'value_asc';
  if (sort === 'name_asc') return 'label';
  if (sort === 'ref_desc' || sort === 'cmp_desc') return 'value_desc';
  return mode === 'metrics' ? 'data' : 'value_desc';
}

function monthStyleOf(fd: Fd): MonthStyle {
  return fd.dc_period_style === 'long' ? 'long' : 'short';
}

export default function transformProps(chartProps: ChartProps): TransformedProps {
  const { width, height, queriesData = [] } = chartProps as any;
  const fd = ((chartProps as any).rawFormData ?? {}) as Fd;
  const mode: 'column' | 'metrics' = fd.dc_mode === 'metrics' ? 'metrics' : 'column';

  const comparison = guardComparison(resolveComparison(fd, temporalFilterValue(fd)), fd);
  const exactTotal = Boolean(fd.dc_exact_total) && mode === 'column';
  const plan = planQueries(comparison, exactTotal);

  const refResult = queriesData[0] ?? { data: [] };
  const cmpResult = plan.cmp !== undefined ? queriesData[plan.cmp] : undefined;

  // Metrics: the slice metrics, plus the total metric apart (denominator).
  const metricLabels: string[] =
    mode === 'metrics' ? (fd.metrics ?? []).map(metricLabelOf) : [metricLabelOf(fd.metric)];
  const totalLabel = mode === 'metrics' && fd.dc_total_metric ? metricLabelOf(fd.dc_total_metric) : null;
  const groupby = mode === 'column' ? columnNameOf((fd.groupby ?? [])[0]) || null : null;
  const rowLimit: number | undefined = mode === 'column' ? Number(fd.row_limit ?? 100) : undefined;

  const refRows = readRows(refResult.data ?? [], mode, groupby, metricLabels);
  const cmpRows = cmpResult ? readRows(cmpResult.data ?? [], mode, groupby, metricLabels) : null;
  const refTruncated = mode === 'column' && isTruncated(refResult, rowLimit);
  const cmpTruncated = mode === 'column' && isTruncated(cmpResult, rowLimit);

  const totalOf = (result: any, label: string | null): number | null => {
    if (!result || !label) return null;
    return parseNumber(result.data?.[0]?.[label]);
  };
  // Denominators: exact total from a dedicated query (column) or the total metric (metrics).
  let refDenominator: number | null = null;
  let cmpDenominator: number | null = null;
  if (exactTotal && plan.refTotal !== undefined) {
    refDenominator = totalOf(queriesData[plan.refTotal], metricLabels[0]);
    if (plan.cmpTotal !== undefined) cmpDenominator = totalOf(queriesData[plan.cmpTotal], metricLabels[0]);
  } else if (mode === 'metrics' && totalLabel) {
    refDenominator = totalOf(refResult, totalLabel);
    if (comparison.active) cmpDenominator = totalOf(cmpResult, totalLabel);
  }

  const model = buildModel({
    mode,
    ref: refRows,
    cmp: cmpRows,
    refTruncated,
    cmpTruncated,
    refDenominator,
    cmpDenominator,
    sliceConfig: toSliceConfig(fd.dc_slice_config),
    defaultPolarity: fd.dc_default_polarity ?? 'higher_is_better',
    other: {
      mode: fd.dc_other_mode ?? 'threshold',
      threshold: Number(fd.dc_other_threshold ?? 2),
      topN: Number(fd.dc_other_top_n ?? 8),
      label: fd.dc_other_label || 'Other',
    },
    sort: mapSort(fd.dc_sort, mode),
    hideZero: fd.dc_hide_zero_slices ?? true,
    colorFor: paletteColor,
  });

  const monthStyle = monthStyleOf(fd);
  const refInfo = periodFromBounds(refResult.from_dttm, refResult.to_dttm, 'Reference', monthStyle);
  const cmpInfo = cmpResult ? periodFromBounds(cmpResult.from_dttm, cmpResult.to_dttm, 'Comparison', monthStyle) : null;
  // A dashboard filter such as the Calendar Filter sends its periods already written (`1-31 May 2005`)
  const dashboardPeriods = readDashboardPeriods(fd.extra_form_data);
  const refLabel =
    fd.dc_ref_label || (fd.extra_form_data?.time_range ? dashboardPeriods.referenceText : undefined) || refInfo.label;
  const cmpLabel = cmpInfo
    ? fd.dc_cmp_label || (comparison.source === 'dashboard' ? dashboardPeriods.comparisonText : undefined) || cmpInfo.label
    : null;

  const notices: Notice[] = [];
  if (!comparison.active && comparison.reason !== 'disabled') {
    const text = INACTIVE_TEXT[comparison.reason];
    if (text) notices.push({ level: 'info', text });
  }
  if (refTruncated) notices.push({ level: 'warning', text: `Reference truncated to ${rowLimit} rows: shares are approximate, calculated on the rows returned. ${EXACT_HINT}` });
  if (cmpTruncated) notices.push({ level: 'warning', text: `Comparison truncated to ${rowLimit} rows: shares are approximate, calculated on the rows returned. ${EXACT_HINT}` });
  if (model.negativeKeys.length > 0) {
    notices.push({ level: 'warning', text: `Negative values cannot be shown in the donut, treated as 0 (${model.negativeKeys.length}).` });
  }

  return {
    width,
    height,
    mode,
    model,
    comparison,
    comparisonActive: comparison.active,
    comparisonType: comparison.active ? comparison.comparisonType : null,
    periods: {
      ref: refInfo,
      cmp: cmpInfo,
      refLabel,
      cmpLabel,
      header: cmpLabel ? `${refLabel} vs ${cmpLabel}` : refLabel,
    },
    notices,
    style: applyTheme(readStyle(fd), (chartProps as any).theme),
    interaction: {
      column: mode === 'column' && groupby ? groupby : null,
      selectedKeys: ((chartProps as any).filterState?.selectedValues ?? []) as string[],
      emit: fd.emit_filter !== false,
      setDataMask: (chartProps as any).setDataMask,
      onContextMenu: (chartProps as any).onContextMenu,
    },
  };
}
