# Project brief — Metrology Data Analyzer

## Purpose

Browser-based tool for **injection molding / metrology** workflows: load dimensional measurement data, explore variation by cavity and run, assess **capability (Cp/Cpk, Pp/Ppk)**, **normality**, **control charts**, and export narrative outputs (e.g. PowerPoint) for engineering review.

## Current artifact

Primary deliverable is a **single-file HTML app** (Ver 1.5): [Metrology Data Analyzer Ver 1.5.html](../Metrology%20Data%20Analyzer%20Ver%201.5.html) — self-contained UI, styles, and client-side logic; third-party libraries loaded from CDNs.

## In scope

- Excel template generation and `.xlsx` / `.xls` / `.csv` ingest
- Standard analysis tab: filters, run chart, cavity statistics table, drawing preview
- Critical Six-Pack: multi-panel Plotly charts, outlier handling, “expert” insight bulbs
- SPC analysis tab
- Action summary tab
- Optional **PDF drawing wizard** (pdf.js): align dimensions to drawing captures (camera / viewfinder workflow)
- **Project save/load** (JSON) preserving workbook buffer and captures where applicable
- **PPTX export** (PptxGenJS) for standard analysis slides
- Light/dark theme with Tailwind + CSS variables

## Out of scope (unless explicitly added)

- Server-side data storage or multi-user auth
- Replacing Plotly / rewriting statistics engine without a product decision
- Native desktop packaging (unless requested)

## Success criteria (engineering)

- Analysts can go from **file → charts → export** without installing desktop SPC software
- Behavior stays predictable when refactoring (modular split is a planned improvement; see [activeContext.md](activeContext.md))
