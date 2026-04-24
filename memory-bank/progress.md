# Progress

## Done

- Single-file **Metrology Data Analyzer Ver 1.5** functional app (standard / six-pack / SPC / summary flows, PDF wizard, project JSON, PPTX export, themes)
- **Ver 1.6** single-file rebuild from modular sources via `scripts/bundle-html.mjs` (`npm run bundle`); `index.html` start page label and Tailwind CDN head fixed for dev parity
- Start page title uses theme-aware `text-slate-100` (not fixed `text-white`) so the app name stays visible when the default **light-mode** body uses light `--sl-*` backgrounds
- Standard analysis series filter corrected so “Select All” can truly deselect every series and child checkboxes/labels stay synced
- Standard steel adjustment input now reloads the saved adjustment for the selected dimension instead of carrying the previous dimension’s value
- Excel drawing export now finds the actual metrology header row, keeps hidden drawing data for app reloads, and adds visible thumbnail previews to the workbook
- Git repository initialized with **origin** remote, **`.gitignore`**, local **user.name** / **user.email**
- **Memory Bank** scaffold (`memory-bank/*.md`) seeded from codebase review

## In flight

- **Modular architecture** implementation (not yet applied to repo as of memory bank creation)

## Known issues / debt

- **Duplicate JS function definitions** at end of HTML file — behavior relies on last definition; remove when refactoring
- **Large script** (~3k lines) — hard to review and test; splitting is the main mitigation

## Backlog (suggested)

- [ ] Implement module split per project plan (`index.html`, `css/app.css`, `js/**`)
- [ ] Add minimal `README` at repo root with “how to run locally” once dev server script exists
- [ ] Optional: unit tests for pure math (`calculateAndersonDarling`, subgroup helpers) after extraction
