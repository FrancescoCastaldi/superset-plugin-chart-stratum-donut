import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { GraphicComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import RichLegend from './RichLegend';
import { buildDonutOption } from '../utils/echartsOption';
import { crossFilterMask, drillToDetailFilters } from '../utils/crossFilter';
import { TransformedProps } from '../plugin/transformProps';

echarts.use([PieChart, TooltipComponent, GraphicComponent, CanvasRenderer]);

interface Handlers {
  onSliceClick: (index: number) => void;
  onSliceContext: (index: number, x: number, y: number) => void;
}

/** Grafico ECharts: ridimensionamento, eventi e pulizia alla rimozione. */
function EchartsDonut({
  option,
  width,
  height,
  handlers,
}: {
  option: Record<string, any>;
  width: number;
  height: number;
  handlers: Handlers;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  // Gli eventi leggono sempre i gestori piu' recenti, senza ri-registrarli.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    chart.on('click', (p: any) => {
      if (typeof p.dataIndex === 'number') handlersRef.current.onSliceClick(p.dataIndex);
    });
    chart.on('contextmenu', (p: any) => {
      const ev = p.event?.event as MouseEvent | undefined;
      ev?.preventDefault?.();
      if (typeof p.dataIndex === 'number' && ev) {
        handlersRef.current.onSliceContext(p.dataIndex, ev.clientX, ev.clientY);
      }
    });
    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  useEffect(() => {
    chartRef.current?.resize({ width, height });
  }, [width, height]);

  return <div ref={ref} style={{ width, height }} />;
}

/** Componente principale: intestazione del periodo, donut, legenda, interazioni e avvisi. */
export default function DonutCompareChart(props: TransformedProps) {
  const { width, height, model, periods, notices, comparisonActive, style, interaction } = props;
  const [hovered, setHovered] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visibleSlices = useMemo(() => model.slices.filter(s => !hidden.has(s.key)), [model, hidden]);
  const visibleModel = useMemo(() => ({ ...model, slices: visibleSlices }), [model, visibleSlices]);
  const option = useMemo(
    () =>
      buildDonutOption(
        visibleModel,
        style,
        { refLabel: periods.refLabel, cmpLabel: comparisonActive ? periods.cmpLabel : null },
        interaction.selectedKeys,
      ),
    [visibleModel, style, periods, comparisonActive, interaction.selectedKeys],
  );

  // Selezione corrente con il valore originale, per costruire il filtro IN.
  const selectedWithRaw = () =>
    model.slices.filter(s => interaction.selectedKeys.includes(s.key)).map(s => ({ key: s.key, raw: s.raw }));

  const handlers: Handlers = {
    onSliceClick: index => {
      const slice = visibleSlices[index];
      if (!slice || !interaction.column || !interaction.emit || !interaction.setDataMask) return;
      const mask = crossFilterMask(interaction.column, selectedWithRaw(), slice);
      if (mask) interaction.setDataMask(mask);
    },
    onSliceContext: (index, x, y) => {
      const slice = visibleSlices[index];
      if (!slice || !interaction.onContextMenu) return;
      const column = interaction.column;
      const payload = {
        drillToDetail: column ? drillToDetailFilters(column, slice) : [],
        crossFilter: column && interaction.emit ? crossFilterMask(column, selectedWithRaw(), slice) : null,
        drillBy: undefined,
      };
      interaction.onContextMenu(x, y, payload);
    },
  };

  const legendRight = style.legendPosition !== 'bottom' && width >= 480;
  const legendWidth = legendRight ? Math.round(width * 0.34) : width;
  const chartHeight = legendRight || !style.legendShow ? height - 28 : Math.round(height * 0.62);
  const chartWidth = legendRight ? width - legendWidth : width;

  const toggle = (key: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div style={{ width, height, display: 'flex', flexDirection: legendRight ? 'row' : 'column', fontSize: 12, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width: chartWidth, height: legendRight ? height : chartHeight, display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', fontWeight: 600, padding: '2px 4px' }}>{periods.header}</div>
        <EchartsDonut option={option} width={chartWidth} height={(legendRight ? height : chartHeight) - 22} handlers={handlers} />
      </div>
      {style.legendShow ? (
        <div style={{ width: legendRight ? legendWidth : width, overflowY: 'auto', padding: '4px 8px' }}>
          <RichLegend
            slices={model.slices}
            columns={style.legendColumns}
            comparison={comparisonActive}
            arrows={style.deltaArrows}
            deltaDecimals={style.deltaDecimals}
            hovered={hovered}
            onHover={setHovered}
            onToggle={toggle}
            hiddenKeys={hidden}
          />
        </div>
      ) : null}
      {notices.length > 0 ? (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 11, opacity: 0.8 }}>
          {notices.map((n, i) => (
            <div key={i}>{n.text}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
