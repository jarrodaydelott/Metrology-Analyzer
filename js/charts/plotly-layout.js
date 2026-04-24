import { isLightMode } from "../state.js";

export function getBaseLayout() {
    const style = getComputedStyle(document.body);
    
    // Dynamically grab the exact colors based on the active mode
    const paperColor = style.getPropertyValue('--sl-800').trim() || (isLightMode ? '#ffffff' : '#18191b');
    const plotColor = isLightMode ? '#F8FAFC' : paperColor;
    const fontColor = style.getPropertyValue('--sl-300').trim() || (isLightMode ? '#111827' : '#9ba1a6');
    
    // Darkened the Light Mode grid from 0.04 to 0.1 so it is clearly visible
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.03)';

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
