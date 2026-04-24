# Tech context

## Runtime

- **Browser-only** client application (static files)
- Recommended dev experience: **local static server** (ES modules / future split may not work from `file://` depending on browser policy)

## Primary source file

- [Metrology Data Analyzer Ver 1.5.html](../Metrology%20Data%20Analyzer%20Ver%201.5.html) — version label shown in start page title

## CDN dependencies (from HTML head)

| Library | Approx. use |
|---------|-------------|
| Tailwind (CDN) | Layout + utilities; custom `tailwind.config` maps `slate.*` to CSS variables |
| SheetJS `xlsx` 0.18.5 | Workbook read / template write |
| ExcelJS 4.3.0 | Advanced Excel manipulation |
| Plotly 2.24.1 | All charts |
| jStat 1.9.6 | Statistical helpers |
| PptxGenJS 3.12.0 | PowerPoint export |
| pdf.js 3.11.174 | PDF render + worker URL configured inline |
| Font Awesome 6.4.0 | Icons |

## Repository

- Remote: `https://github.com/jarrodaydelott/Metrology-Analyzer.git` (see local `git remote`)
- [`.gitignore`](../.gitignore) excludes OS noise, `.env`, optional `node_modules` / venv

## Tooling (optional / future)

- No `package.json` required for current single-file workflow
- Modular refactor may add `package.json` with `serve` or Vite — update this file when that lands
