import { isLightMode } from "../state.js";
import { getChartRefColors, getThemeVar } from "../theme.js";

export function getBaseLayout() {
    const chartRef = getChartRefColors(isLightMode);
    const paperColor = getThemeVar('--sl-800', isLightMode ? '#ffffff' : '#0f172a');
    const plotColor = isLightMode ? chartRef.plotBg : getThemeVar('--sl-850', '#1e293b');
    const fontColor = getThemeVar('--sl-100', isLightMode ? '#0f172a' : '#e2e8f0');
    const gridColor = chartRef.grid;

    return { 
        autosize: true, 
        margin: { t: 40, r: 20, l: 40, b: 40 }, 
        font: { size: 10, family: 'Segoe UI', color: fontColor }, 
        showlegend: false, 
        plot_bgcolor: plotColor, 
        paper_bgcolor: paperColor, 
        xaxis: { gridcolor: gridColor, automargin: true }, 
        yaxis: { gridcolor: gridColor, automargin: true }, 
        titleFontColor: fontColor 
    };
}
