# Changelog

Formato Keep a Changelog 1.1.0, versioni SemVer.

## [0.1.0] - 2026-10-31

### Added
- Donut a doppio anello: riferimento all'esterno, confronto all'interno.
- Fette da colonna o da metriche.
- Sorgenti del confronto: filtro dashboard PeriodCompare, preset del chart, nessun confronto.
- Due query con la stessa forma: la finestra temporale cambia, le colonne restano.
- Gestione di fette nuove e scomparse, con stato "Nuovo" e "Assente".
- Raggruppamento in "Altro" per soglia o per prime N fette, e fetta "Altri" con totale esatto.
- Polarità per fetta: meglio se maggiore, minore o neutro.
- Legenda interattiva con valore, quota e variazione in punti.
- Testo centrale con totale e variazione.
- Cross-filter con clic e drill to detail con clic destro.
- Pannello di controllo senza JSON, con controllo per fetta.
- Installer idempotente che registra il plugin in `MainPreset.ts`.
- Dev-studio con scenari di esempio.

### Fixed
- Le chiavi assenti da un periodo troncato dal limite di righe non diventano zero inventati.
- Il segno non compare sui valori che arrotondano a zero.
- Il colore del testo segue il tema di Superset.
