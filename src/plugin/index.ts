import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from '../images/thumbnail.png';
import example from '../images/example.png';

const t = (str: string) => str;

const metadata = new ChartMetadata({
  name: t('StratumDonut: double ring'),
  description: t(
    'Double-ring donut to compare two periods: shares, changes and a rich legend. The comparison period comes from the PeriodCompare filter or from the chart preset.',
  ),
  behaviors: [Behavior.InteractiveChart],
  category: t('Part of a Whole'),
  tags: [t('Stratum'), t('Donut'), t('Pie'), t('Comparison'), t('Period'), t('Shares')],
  credits: ['Francesco Castaldi'],
  exampleGallery: [{ url: example }],
  thumbnail,
});

export default class StratumDonutChartPlugin extends ChartPlugin {
  constructor() {
    super({
      buildQuery: buildQuery as any,
      controlPanel,
      loadChart: () => import('../components/StratumDonutChart'),
      metadata,
      transformProps: transformProps as any,
    });
  }
}
