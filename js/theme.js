/** Metrology Analyzer theme preference (defaults to light when unset). */
export const METROLOGY_THEME_KEY = 'metrology-analyzer-theme';

/** @deprecated Shared DOE SUITE key — no longer read on launch; kept for reference only. */
export const DOE_THEME_KEY = 'doe-theme';

export function readStoredThemeIsLight() {
    const stored = localStorage.getItem(METROLOGY_THEME_KEY);
    if (stored === 'dark') return false;
    return true;
}

export function persistThemeIsLight(isLight) {
    localStorage.setItem(METROLOGY_THEME_KEY, isLight ? 'light' : 'dark');
}

export const THEME_TRANSITION_MS = 350;

export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getOrCreateThemeOverlay() {
    let overlay = document.getElementById('theme-transition-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'theme-transition-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.appendChild(overlay);
    }
    return overlay;
}

function runOverlayThemeTransition(updateDom, onComplete) {
    const overlay = getOrCreateThemeOverlay();
    overlay.style.backgroundColor = getThemeVar('--bg-page', '#020617');
    overlay.classList.add('is-covering');
    void overlay.offsetHeight;

    Promise.resolve(updateDom()).then(() => {
        requestAnimationFrame(() => {
            overlay.classList.remove('is-covering');
        });

        let done = false;
        const complete = () => {
            if (done) return;
            done = true;
            overlay.classList.remove('is-covering');
            onComplete();
        };
        overlay.addEventListener('transitionend', complete, { once: true });
        setTimeout(complete, THEME_TRANSITION_MS + 50);
    });
}

/** Cross-fade theme DOM updates; updateDom may return a Promise (e.g. await chart relayout). */
export function runThemeTransition(updateDom) {
    const run = () => Promise.resolve(updateDom());

    return new Promise((resolve) => {
        if (prefersReducedMotion()) {
            run().then(resolve);
            return;
        }

        if (typeof document.startViewTransition === 'function') {
            document.startViewTransition(() => run()).finished.then(resolve).catch(resolve);
            return;
        }

        runOverlayThemeTransition(() => run(), resolve);
    });
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
