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

/** DOE 00-uiTheme.js line / limit colors */
export function getChartRefColors(isLight) {
    if (isLight) {
        return {
            grid: '#e2e8f0',
            nominal: '#16a34a',
            limit: '#dc2626',
            plotBg: '#f8fafc',
        };
    }
    return {
        grid: '#334155',
        nominal: '#4ade80',
        limit: '#f87171',
        plotBg: getThemeVar('--sl-850', '#1e293b'),
    };
}

export const CHART_SERIES_PALETTE_LIGHT = ['#4A78B0', '#B25A5A', '#5E8D6B', '#C09241', '#8D70A3', '#5C9494', '#B85C74', '#60699F', '#A9704C', '#7A8D55'];
export const CHART_SERIES_PALETTE_DARK = ['#3b82f6', '#f87171', '#4ade80', '#eab308', '#a855f7', '#06b6d4', '#fb7185', '#fb923c', '#84cc16', '#5eead4'];
