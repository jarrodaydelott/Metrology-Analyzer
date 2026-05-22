/** Shared with DOE SUITE — same localStorage key for light/dark across apps. */
export const DOE_THEME_KEY = 'doe-theme';

export function readStoredThemeIsLight() {
    const stored = localStorage.getItem(DOE_THEME_KEY);
    if (stored === 'dark') return false;
    if (stored === 'light') return true;
    return true;
}

export function persistThemeIsLight(isLight) {
    localStorage.setItem(DOE_THEME_KEY, isLight ? 'light' : 'dark');
}

export function getThemeVar(name, fallback = '') {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

/** Temporarily apply light/dark on body so computed tokens match requested mode (e.g. PPTX export). */
export function withThemeMode(isLight, fn) {
    const el = document.body;
    const hadLight = el.classList.contains('light-mode');
    if (hadLight !== isLight) el.classList.toggle('light-mode', isLight);
    try {
        return fn();
    } finally {
        if (hadLight !== isLight) el.classList.toggle('light-mode', hadLight);
    }
}

const SERIES_FALLBACK_DARK = ['#3b82f6', '#f87171', '#4ade80', '#eab308', '#a855f7', '#06b6d4', '#fb7185', '#fb923c', '#84cc16', '#5eead4'];
const SERIES_FALLBACK_LIGHT = ['#4A78B0', '#B25A5A', '#5E8D6B', '#C09241', '#8D70A3', '#5C9494', '#B85C74', '#60699F', '#A9704C', '#7A8D55'];

function readCssChartTokens() {
    return {
        grid: getThemeVar('--chart-grid', '#334155'),
        nominal: getThemeVar('--chart-nominal', '#4ade80'),
        limit: getThemeVar('--chart-limit', '#f87171'),
        plotBg: getThemeVar('--chart-plot-bg', getThemeVar('--sl-850', '#1e293b')),
    };
}

/** Chart reference lines / plot background — reads from css/design-tokens.css */
export function getChartRefColors(isLight) {
    return withThemeMode(isLight, readCssChartTokens);
}

/** Ten series colors for Plotly — reads --series-1 … --series-10 from design tokens */
export function getChartSeriesPalette(isLight) {
    const fallback = isLight ? SERIES_FALLBACK_LIGHT : SERIES_FALLBACK_DARK;
    return withThemeMode(isLight, () => {
        const palette = [];
        for (let i = 1; i <= 10; i++) {
            palette.push(getThemeVar(`--series-${i}`, fallback[i - 1]));
        }
        return palette;
    });
}

/** @deprecated Use getChartSeriesPalette(isLight) — kept for import compatibility */
export const CHART_SERIES_PALETTE_LIGHT = SERIES_FALLBACK_LIGHT;
/** @deprecated Use getChartSeriesPalette(isLight) */
export const CHART_SERIES_PALETTE_DARK = SERIES_FALLBACK_DARK;
