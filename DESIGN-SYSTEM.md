# Metrology Analyzer Design System

Portable design tokens and implementation notes for **Metrology Analyzer**, **DOE SUITE**, and other engineering analytics apps. The visual language is a **precision instrument**: cool slate depth in dark mode, blue-tinted drafting-paper surfaces in light mode.

**Source of truth:** [`css/design-tokens.css`](css/design-tokens.css)

---

## Design philosophy

| Principle | Application |
|-----------|-------------|
| Cool foundation | Navy/slate in dark; `#edf2ff` page tint in light — not flat gray |
| Semantic slate scale | `--sl-*` numbers are **roles**, not literal shades (inverted in light mode) |
| Accent restraint | Red/green/yellow for status; blue for actions and active UI |
| Depth via surface steps | Page → elevated → card (`--sl-900` → `--sl-850` → `--sl-800`) |
| Charts follow tokens | Grid, limits, nominal, plot background, and series colors live in CSS |

---

## Theme switching

```text
Dark  → body without class `light-mode` (:root tokens)
Light → body.light-mode (overrides in design-tokens.css)
Storage → localStorage key `doe-theme` = `light` | `dark` (shared with DOE SUITE)
```

Toggle in JS:

```javascript
document.body.classList.toggle('light-mode', isLight);
localStorage.setItem('doe-theme', isLight ? 'light' : 'dark');
```

Read a token:

```javascript
getComputedStyle(document.body).getPropertyValue('--accent-primary').trim();
```

---

## Color palette

### Dark mode (`:root`)

| Token | Hex / value | Usage |
|-------|-------------|--------|
| `--sl-900` | `#020617` | Page background |
| `--sl-850` | `#1e293b` | Elevated panels, chart plot |
| `--sl-800` | `#0f172a` | Cards, modals |
| `--sl-200` | `#e2e8f0` | Primary text |
| `--sl-400` | `#94a3b8` | Muted text, tabs |
| `--accent-primary` | `#3b82f6` | Links, active tab, focus |
| `--accent-success` | `#86efac` | Pass / capable |
| `--accent-danger` | `#fca5a5` | Fail / critical |
| `--accent-warning` | `#fcd34d` | Caution |
| `--chart-grid` | `#334155` | Plotly grid |
| `--chart-nominal` | `#4ade80` | Target / mean line |
| `--chart-limit` | `#f87171` | USL / LSL |
| `--chart-plot-bg` | `var(--sl-850)` | Plot area |
| `--process-insight-bg` | `rgba(127,29,29,0.4)` | Alert banner |
| `--process-insight-border` | `rgba(248,113,113,0.35)` | Alert border |

### Light mode (`body.light-mode`)

Soft contrast: no pure white surfaces; page and cards stay in the same cool gray-blue family to reduce glare.

| Token | Hex / value | Usage |
|-------|-------------|--------|
| `--sl-900` | `#dce4f0` | Page background |
| `--sl-950` | `#e8edf5` | Header / nav |
| `--sl-850` | `#eef2f8` | Elevated panels, inputs, chart inset |
| `--sl-800` | `#f4f6fa` | Cards (off-white, not `#fff`) |
| `--sl-750` | `#d8e0ec` | Hover / secondary surfaces |
| `--sl-200` | `#334155` | Primary text (softer than near-black) |
| `--accent-primary` | `#3b82f6` | Actions (matches dark vibrancy) |
| `--accent-success` | `#16a34a` | Pass states |
| `--accent-danger` | `#dc2626` | Fail states |
| `--accent-warning` | `#d97706` | Caution |
| `--chart-grid` | `#dde5f5` | Plotly grid |
| `--chart-plot-bg` | `#eef2f8` | Plot area |
| `--process-insight-bg` | `rgba(220,38,38,0.06)` | Alert banner |
| `--process-insight-border` | `rgba(220,38,38,0.4)` | Alert border |

### Semantic aliases (both modes)

| Alias | Maps to |
|-------|---------|
| `--bg-page` | `--sl-900` |
| `--bg-surface` | `--sl-800` |
| `--bg-elevated` | `--sl-850` |
| `--text-primary` | `--sl-200` |
| `--text-muted` | `--sl-400` |
| `--border-default` | `--sl-700` |
| `--color-success-fg` | `--accent-success` |
| `--color-danger-fg` | `--accent-danger` |
| `--color-warning-fg` | `--accent-warning` |

### Chart series (10 colors)

Defined as `--series-1` … `--series-10` in `design-tokens.css`.

**Dark:** `#3b82f6`, `#f87171`, `#4ade80`, `#eab308`, `#a855f7`, `#06b6d4`, `#fb7185`, `#fb923c`, `#84cc16`, `#5eead4`

**Light (muted enterprise):** `#4A78B0`, `#B25A5A`, `#5E8D6B`, `#C09241`, `#8D70A3`, `#5C9494`, `#B85C74`, `#60699F`, `#A9704C`, `#7A8D55`

---

## Typography

| Role | Tailwind / CSS | Notes |
|------|----------------|-------|
| UI | System sans via Tailwind CDN | Default stack from Tailwind |
| Data / specs | `font-mono` | Nom, USL, LSL in chart meta |
| Section title | `text-sm font-bold` / `.sp-chart-title` | `0.875rem`, weight 700 |
| KPI value | `text-2xl font-bold` | Mean, variance banner |
| KPI label | `text-xs uppercase tracking-wide` | `var(--sl-500)` |

---

## Elevation and shadows

| Level | Dark | Light |
|-------|------|-------|
| Card | `0 8px 24px rgba(0,0,0,0.35)` + `border: rgba(255,255,255,0.06)` | `0 4px 6px rgba(0,0,0,0.05)` + `border: rgba(0,0,0,0.04)` |
| Nav | Bottom border `rgba(255,255,255,0.06)` | `0 1px 3px rgba(0,0,0,0.05)` |
| Input focus | `0 0 0 1px var(--focus-ring)` | Same |

---

## Component patterns

### Card

```html
<div class="bg-slate-800 rounded-lg border border-slate-700 p-4">...</div>
```

Tailwind `slate-*` is mapped to `var(--sl-*)` in `index.html` Tailwind config.

### Process insight alert

Uses `#spWarning` styles: `background: var(--process-insight-bg)`, left accent `var(--chart-limit)`.

### Status text (prefer over fixed Tailwind greens/reds)

```html
<span class="text-status-success">Capable</span>
<span class="text-status-danger">Critical</span>
<span class="text-status-warning">Review</span>
```

### Accent utilities

- `.text-accent-primary`, `.text-accent-success`, `.text-accent-danger`, `.text-accent-warning`

---

## Implementation in a new app

### 1. Copy tokens

Copy [`css/design-tokens.css`](css/design-tokens.css) into the project. Import from your main stylesheet:

```css
@import './design-tokens.css';
```

### 2. Wire Tailwind (optional)

```javascript
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          100: 'var(--sl-100)',
          200: 'var(--sl-200)',
          // … through 950
        }
      }
    }
  }
};
```

Use **`body.light-mode`** for light theme (not `html.dark` unless you mirror DOE SUITE’s `html.dark` pattern).

### 3. JavaScript theme module

Mirror [`js/theme.js`](js/theme.js):

- `readStoredThemeIsLight()` / `persistThemeIsLight()`
- `getChartRefColors(isLight)` — reads `--chart-*` via `withThemeMode`
- `getChartSeriesPalette(isLight)` — reads `--series-1` … `--series-10`

### 4. Plotly

On theme change, relayout charts with colors from `getChartRefColors(isLightMode)` and series from `getChartSeriesPalette(isLightMode)`.

### 5. Drawings in dark mode

Invert white engineering drawings while preserving red markup:

```css
body:not(.light-mode) .engineering-drawing {
  filter: invert(1) hue-rotate(180deg) brightness(0.9);
}
```

Exclude PDF viewfinder overlays from the filter.

---

## Token cheat sheet (copy-paste)

See full blocks in [`css/design-tokens.css`](css/design-tokens.css). Minimal integration:

```css
@import './design-tokens.css';

body { background: var(--bg-page); color: var(--text-primary); }
.card { background: var(--bg-surface); border: 1px solid var(--border-default); }
```

```javascript
const isLight = localStorage.getItem('doe-theme') !== 'dark';
document.body.classList.toggle('light-mode', isLight);
```

---

## File map (this repo)

| File | Role |
|------|------|
| `css/design-tokens.css` | All color variables — **share this file** |
| `css/app.css` | Component polish, imports tokens |
| `js/theme.js` | Storage, CSS var readers, chart helpers |
| `DESIGN-SYSTEM.md` | This document |
| `scripts/bundle-html.mjs` | Inlines tokens + app CSS into single HTML |

---

## Export branding (PPTX only)

Separate from UI tokens in [`js/constants.js`](js/constants.js):

- `BRAND_DARK_BLUE` = `033063`
- `BRAND_ORANGE` = `FF9900`

Slide charts use **light** tokens via `getChartRefColors(true)` even when the UI is in dark mode.
