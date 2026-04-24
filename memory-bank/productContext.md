# Product context

## Users

Process / quality engineers and metrology-focused staff who work with **cavity-grouped dimensional data** (often from templates or CMM exports) and need quick **visual + numeric** capability assessment.

## Problems addressed

- **Compare cavities and runs** without fighting Excel pivot defaults
- See **run charts**, **histogram / probability plot**, **control charts**, and **capability indices** in one place
- Highlight **non-normality**, **mixed populations**, **drift**, and **range-chart instability** with guided copy (AI-style sidebar and “light bulb” tips)
- Attach **dimension drawing snippets** (from PDF or capture) for context in analysis and exports
- Communicate findings via **exported slide deck**

## UX principles (as implemented)

- **Start page**: generate a new Excel template *or* jump straight to analysis if a file already exists
- **Dense pro UI**: small typography in chrome; Tailwind utility layout; dark mode tuned to reduce border fatigue (`#121212`-style base)
- **Tab model**: Standard Analysis → Critical Six-Pack → SPC Analysis → Action Summary
- **Inline help**: chart help modals, normality flags explainer, expandable chart fullscreen
- **Steel adjustment** input on relevant views for tooling offset style corrections

## Notable UI surfaces

- Nav: data file upload, units, target Cpk, PDF setup, project open/save, PPTX export, theme toggle
- Filters: type, dimension, run, series (standard view); parallel filters on six-pack
- Drawing panels: standard inline drawing; six-pack static drawing; PDF wizard list per dimension
