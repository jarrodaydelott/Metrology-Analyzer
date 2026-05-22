import { isLightMode } from "../state.js";
import { getChartRefColors, getThemeVar } from "../theme.js";

/** Shared Plotly x/y axis styling — soft axis lines in light mode, hidden in dark mode. */
export function getPlotlyAxisTheme() {
    const chartRef = getChartRefColors(isLightMode);
    const gridColor = chartRef.grid;
    const fontColor = getThemeVar("--sl-200", isLightMode ? "#334155" : "#e2e8f0");
    const axisLineColor = getThemeVar("--chart-axis", isLightMode ? "#94a3b8" : "#475569");

    const base = {
        gridcolor: gridColor,
        automargin: true,
        color: fontColor,
        zeroline: false,
        mirror: false,
    };

    if (isLightMode) {
        return {
            ...base,
            showline: true,
            linecolor: axisLineColor,
            linewidth: 1,
            tickcolor: axisLineColor,
            tickwidth: 1,
        };
    }

    return {
        ...base,
        showline: false,
    };
}

export function getBaseLayout() {
    const chartRef = getChartRefColors(isLightMode);
    const paperColor = getThemeVar('--sl-800', isLightMode ? '#ffffff' : '#0f172a');
    const plotColor = isLightMode ? chartRef.plotBg : getThemeVar('--sl-850', '#1e293b');
    const fontColor = getThemeVar('--sl-100', isLightMode ? '#0f172a' : '#e2e8f0');
    const axisTheme = getPlotlyAxisTheme();

    return { 
        autosize: true, 
        margin: { t: 40, r: 20, l: 40, b: 40 }, 
        font: { size: 10, family: 'Segoe UI', color: fontColor }, 
        showlegend: false, 
        plot_bgcolor: plotColor, 
        paper_bgcolor: paperColor, 
        xaxis: { ...axisTheme }, 
        yaxis: { ...axisTheme }, 
        titleFontColor: fontColor 
    };
}
