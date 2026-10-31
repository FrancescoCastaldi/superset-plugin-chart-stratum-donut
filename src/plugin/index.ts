import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from '../images/thumbnail.png';
import example from '../images/example.png';

const t = (str: string) => str;

const metadata = new ChartMetadata({
  name: t('Donut Compare: doppio anello'),
  description: t(
    'Donut a doppio anello per confrontare due periodi: quote, variazioni e legenda ricca. Il periodo di confronto arriva dal filtro PeriodCompare o dal preset del chart.',
  ),
  behaviors: [Behavior.InteractiveChart],
  category: t('Part of a Whole'),
  tags: [t('Donut'), t('Pie'), t('Confronto'), t('Periodo'), t('Quote')],
  credits: ['Francesco Castaldi'],
  exampleGallery: [{ url: example }],
  thumbnail,
});

export default class DonutCompareChartPlugin extends ChartPlugin {
  constructor() {
    super({
      buildQuery: buildQuery as any,
      controlPanel,
      loadChart: () => import('../components/DonutCompareChart'),
      metadata,
      transformProps: transformProps as any,
    });
  }
}
