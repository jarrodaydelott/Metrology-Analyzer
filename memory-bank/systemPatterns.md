# System patterns

## Architecture (today)

- **Monolithic HTML**: one `<style>` block (~180 lines) + one large `<script>` (~3k lines) after markup
- **No bundler**: all application logic assumes browser globals from CDN scripts (`Plotly`, `XLSX`, `ExcelJS`, `jStat`, `PptxGenJS`, `pdfjsLib`, Tailwind)
- **Imperative DOM**: `document.getElementById`, `innerHTML` for dynamic tables and Plotly containers
- **Global functions** invoked from HTML `onclick` / `onchange` — easy to grep but couples markup to JS names

## State

- Central **mutable globals** at top of script (e.g. `globalData`, `adjustments`, `ignoredIds`, filter `Set`s, PDF wizard state, `dimensionImages` map for base64 snippets)
- `window.currentInsights` and `window.showInsight` used for six-pack “bulb” → sidebar flow

## Statistics / charts

- **jStat** for means, stdevs, normal CDF, etc.
- **Custom** Anderson–Darling and related helpers in-script
- **Plotly** for run chart, histogram, prob plot, control charts, capability interval panel, six-pack grid
- **D2 / D4 style constants** embedded for subgroup control chart math

## File / persistence

- **Excel**: SheetJS (`xlsx`) + ExcelJS for richer operations (e.g. drawing injection path)
- **Project**: JSON download/upload; retains `rawWorkbookBuffer` and metadata where designed
- **Export**: PptxGenJS builds branded slides; chart-to-image path for standard analysis

## Theming

- `html` / `body` class `dark` vs `body.light-mode` toggles CSS variables (`--sl-*`) consumed by Tailwind overrides and custom CSS

## Known code smell (document for refactors)

- **Duplicate function definitions** appear late in the script (e.g. `updateDrawingPopupImage`, `closeAiHelper`, `executeSurgicalCapture`, `refreshPdfDimList`) — last definition wins at runtime; consolidate when splitting modules

## Planned direction

- Modular ES modules + extracted `css/app.css` + thin `index.html` (see repo plan / [activeContext.md](activeContext.md)); bridge period may assign `window.fn = fn` for existing `onclick` handlers
