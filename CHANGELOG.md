# Changelog

Keep a Changelog 1.1.0 format, SemVer versioning.

## [0.1.1] - 2026-11-01

### Added
- **Periods named as the dashboard filter writes them**: with a dashboard filter such as the Calendar Filter the header uses the ranges the filter sends (`1-31 May 2005 vs 31 Mar - 30 Apr 2005`, in its language) instead of the raw bounds. Labels typed in the control panel win.
- 2 new tests (130 in total).

## [0.1.0] - 2026-10-31

### Added
- Double-ring donut: reference period on the outside, comparison period on the inside.
- Slices from a column or from metrics.
- Comparison sources: PeriodCompare dashboard filter, chart preset, or no comparison.
- Two queries with the same shape: only the time window changes, columns stay the same.
- New and missing slices, marked "New" and "Missing".
- Grouping into "Other" by threshold or by top N slices, with a "Rest" slice for the exact total.
- Polarity per slice: higher is better, lower is better, or neutral.
- Interactive legend with value, share and point change.
- Center text with the total and its change.
- Cross-filter on click and drill to detail on right click.
- Control panel without JSON, with a per-slice control.
- Idempotent installer that registers the plugin in `MainPreset.ts`.
- Dev studio with sample scenarios.

### Fixed
- Keys missing from a period truncated by the row limit do not become invented zeros.
- No sign on values that round to zero.
- Text color follows the Superset theme.
- Slices with colliding keys (e.g. `boy` and `girl`) get distinct colors, assigned by position.
