# StratumDonut: doppio anello per Apache Superset 6.1.0

Chart plugin che confronta due periodi in un unico donut: l'anello esterno è il periodo di riferimento, quello interno il confronto. Ogni fetta mostra valore, quota, variazione in punti di quota e variazione percentuale, con una legenda interattiva.

Il periodo di confronto arriva dal filtro nativo **PeriodCompare** (vedi `superset-period-compare`), oppure dal preset scelto nel chart (periodo precedente, anno precedente, intervallo personalizzato).

## Funzioni

- **Fette da colonna** (una fetta per valore di una dimensione) oppure **da metriche** (una fetta per metrica, es. riuscite, fallite, incomplete).
- **Confronto** con più sorgenti: filtro dashboard, preset del chart, nessun confronto. Se il periodo di riferimento è relativo (es. "Last month") il confronto usa uno shift nativo.
- **Due query** con le stesse colonne e metriche: cambia solo la finestra temporale. Le fette presenti in un solo periodo restano, marcate come nuove o scomparse.
- **Altro**: fette sotto soglia o oltre le prime N raggruppate in "Altro", con lo stesso gruppo su entrambi gli anelli.
- **Limite di righe**: se una query è troncata le quote sono approssimate, e il pannello lo segnala. Per il totale reale si attiva "Totale esatto" (solo modalità colonna).
- **Polarità**: per ogni fetta si sceglie se una variazione positiva è buona, cattiva o neutra (es. fallite: meglio se minori).
- **Interazioni**: clic su una fetta per il cross-filter della dashboard, clic destro per il drill to detail.
- **Tema**: testo ed etichette seguono il tema di Superset.

## Pannello di controllo

Nessun JSON da scrivere a mano.

- **Dati**: modalità, metrica o metriche, dimensione, filtri, colonna temporale, sorgente e preset del confronto.
- **Customize**: periodi ed etichette, anelli (raggio, spessore, distanza, angolo), etichette (contenuto, posizione, soglia), fette (nome, colore, visibilità, polarità, formato, tramite un controllo per fetta), raggruppamento e ordine, legenda, testo centrale, tooltip, delta e formati.

## Installazione

Dalla cartella del plugin, con un checkout di Superset 6.1.0:

```powershell
.\install-plugin.ps1 -SupersetPath C:\percorso\superset
```

Lo script copia il plugin in `superset-frontend/plugins/`, registra `StratumDonutChartPlugin` in `MainPreset.ts` (idempotente, con backup `.bak`) e aggiunge le dipendenze mancanti in `package.json`. Poi ricompilare il frontend di Superset e riavviare.

## Sviluppo

```powershell
npm install
npm run build      # bundle in dist/
npm test           # test unitari
```

Per vedere il grafico senza Superset, il dev-studio in `dev-studio/` esegue il codice reale del plugin con scenari di esempio:

```powershell
cd dev-studio
npm install
npx vite --port 5174
```

## Struttura

- `src/plugin/`: buildQuery (due query), queryPlan (indici delle query), transformProps (dati e stile), controlPanel (pannelli), controls/sliceConfig (controllo per fetta).
- `src/utils/`: comparison (scelta del confronto), dates e periodLabel (periodi in italiano), merge (unione dei periodi, Altro, rest), model (modello dati), format, style, echartsOption (opzione ECharts), crossFilter.
- `src/components/`: StratumDonutChart (grafico e interazioni), RichLegend (legenda).
- `test/`: test unitari su date, confronto, unione, modello, formati, opzione ECharts, pannello e cross-filter.

## Limiti noti

- Il drill by non è incluso: il menu contestuale offre solo il drill to detail.
- Con un periodo troncato le quote dell'altro periodo sono approssimate (vedi avviso).
- Il collaudo visivo completo nel clone Superset con PeriodCompare non è ancora stato fatto.
