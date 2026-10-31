import { useEffect, useMemo, useState } from 'react';
import StratumDonutChart from '../../src/components/StratumDonutChart';
import transformProps from '../../src/plugin/transformProps';
import { SCENARIOS } from './scenarios';

/** Riquadro di sviluppo: esegue il transformProps reale e mostra il grafico. */
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const initial = SCENARIOS.find(s => s.id === params.get('scenario'))?.id ?? SCENARIOS[0].id;
  const [id, setId] = useState(initial);
  const [width, setWidth] = useState<number | null>(null);
  // Selezione simulata: sostituisce il filterState di Superset per il cross-filter.
  const [selected, setSelected] = useState<string[]>([]);
  const scenario = SCENARIOS.find(s => s.id === id)!;
  const stageWidth = width ?? scenario.width ?? 640;

  useEffect(() => {
    setSelected([]);
  }, [id]);

  useEffect(() => {
    document.body.classList.toggle('dark', Boolean(scenario.dark));
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', id);
    window.history.replaceState({}, '', url);
  }, [id, scenario.dark]);

  const props = useMemo(() => {
    const chartProps = {
      width: stageWidth,
      height: 380,
      rawFormData: scenario.formData,
      queriesData: scenario.queries,
      filterState: { selectedValues: selected },
      emitCrossFilters: true,
      setDataMask: (mask: any) => setSelected(mask.filterState.selectedValues),
      onContextMenu: (x: number, y: number, payload: any) => console.log('contextmenu', x, y, payload),
      theme: scenario.dark ? { colorText: '#e6e8eb', colorBgContainer: '#1d2127' } : { colorText: '#1f2933', colorBgContainer: '#ffffff' },
    };
    return transformProps(chartProps as any);
  }, [scenario, stageWidth, selected]);

  return (
    <div>
      <div className="bar">
        <label>
          Scenario{' '}
          <select value={id} onChange={e => setId(e.target.value)}>
            {SCENARIOS.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Larghezza{' '}
          <select value={stageWidth} onChange={e => setWidth(Number(e.target.value))}>
            {[360, 480, 640, 900].map(w => (
              <option key={w} value={w}>
                {w} px
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setSelected([])}>Pulisci selezione</button>
        <span>Selezionate: {selected.length ? selected.join(', ') : 'nessuna'}</span>
        <span>Quota totale riferimento: {props.model.refTotal.toLocaleString('it-IT')}</span>
      </div>

      <div className="stage" style={{ width: stageWidth + 2 }}>
        <StratumDonutChart {...props} width={stageWidth} height={380} />
      </div>

      <table>
        <thead>
          <tr>
            <th>Fetta</th>
            <th>Riferimento</th>
            <th>Confronto</th>
            <th>Quota rif.</th>
            <th>Δ quota (pt)</th>
            <th>Δ %</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          {props.model.slices.map(s => (
            <tr key={s.key}>
              <td>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: s.color, marginRight: 6 }} />
                {s.label}
              </td>
              <td>{s.refValue.toLocaleString('it-IT')}</td>
              <td>{s.cmpValue === null ? '—' : s.cmpValue.toLocaleString('it-IT')}</td>
              <td>{(s.refShare * 100).toFixed(1)}%</td>
              <td>{s.deltaPts === null ? '—' : s.deltaPts.toFixed(1)}</td>
              <td>{s.deltaPct === null ? '—' : s.deltaPct.toFixed(1)}</td>
              <td>
                {s.isNew ? 'nuova' : s.isGone ? 'scomparsa' : s.unknown !== 'none' ? 'sconosciuta' : s.isOther ? 'altro' : ''}
                {s.sentiment !== 'neutral' ? ` · ${s.sentiment}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {props.notices.length > 0 ? (
        <ul>
          {props.notices.map((n, i) => (
            <li key={i}>
              [{n.level}] {n.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
