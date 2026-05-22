/* global Plotly */

import {
  globalData,
  adjustments,
  activeRunFilter,
  activeSeriesFilter,
  isLightMode,
  currentTab,
} from "../state.js";
import { calculateSkewness } from "../math/stats.js";
import { getSeriesLabel, getFullDimensionName } from "../utils/labels.js";
import {
  persistThemeIsLight,
  readStoredThemeIsLight,
  getChartRefColors,
  getChartSeriesPalette,
  getThemeVar,
} from "../theme.js";

// ==========================================
// 6. DASHBOARD & ANALYSIS LOGIC
// ==========================================
export function updateDashboard() {
    const selectedDim = document.getElementById('dimSelect').value;
    if (!selectedDim) return;

    let dimData = globalData.filter(d => d.element === selectedDim);
    const unit = document.getElementById('unitSelect').value;
    const adj = adjustments[selectedDim] || 0;
    const adjInd = document.getElementById('adjIndicator');
    const targetCpk = parseFloat(document.getElementById('targetCpkInput').value) || 1.33;

    if (adj !== 0) {
        adjInd.textContent = `(Adjusted by ${adj > 0 ? '+' : ''}${adj})`;
        adjInd.classList.remove('hidden');
    } else {
        adjInd.classList.add('hidden');
    }

    if (dimData.length === 0) return;

    const rec = dimData[0];
    const specsText = `Nom: ${rec.nominal.toFixed(4)} | USL: ${rec.usl.toFixed(4)} | LSL: ${rec.lsl.toFixed(4)}`;
    document.getElementById('chartMeta').innerHTML = `<span class="text-slate-400 font-mono text-sm">${specsText}</span> <span class="text-blue-500 ml-2 text-xs font-bold">[${unit}]</span>`;

    const badge = document.getElementById('descBadge');
    if (rec.description) {
        badge.textContent = rec.description;
        let badgeClass = "px-2 py-0.5 rounded text-xs font-bold border ";
        if (rec.description === 'Critical') badgeClass += "bg-red-900 text-red-200 border-red-700";
        else if (rec.description === 'FAI') badgeClass += "bg-purple-900 text-purple-200 border-purple-700";
        else badgeClass += "bg-slate-700 text-slate-300 border-slate-600";
        badge.className = badgeClass;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    let allAvailableSeries = [...new Set(dimData.map(d => getSeriesLabel(d)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    
    let seriesList = allAvailableSeries.filter(s => {
        const match = s.match(/\((.*?)\)$/);
        const runName = match ? match[1] : "No Run"; 
        return activeRunFilter.has(runName);
    });

    const stats = [];
    const plotTraces = [];

    const colors = getChartSeriesPalette(isLightMode);
    
    let allFilteredValues = [];

    seriesList.forEach((series, idx) => {
        const seriesData = dimData.filter(d => getSeriesLabel(d) === series).sort((a,b) => a.sample - b.sample);
        const values = seriesData.map(d => d.value + adj);
        const isVisible = activeSeriesFilter.has(series);

        if (isVisible) {
            allFilteredValues = allFilteredValues.concat(values);
            
            const n = values.length;
            const sum = values.reduce((a, b) => a + b, 0);
            const mean = sum / n;
            const statVariance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1 || 1);
            const stdDev = Math.sqrt(statVariance);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const variance = max - min;
            
            let mrSum = 0, mrCount = 0;
            for (let i = 1; i < n; i++) {
                mrSum += Math.abs(values[i] - values[i-1]);
                mrCount++;
            }
            const withinStDev = mrCount > 0 ? (mrSum / mrCount) / 1.128 : stdDev;
            
            let cpk = 0;
            if (withinStDev > 0) {
                const cpu = (rec.usl - mean) / (3 * withinStDev);
                const cpl = (mean - rec.lsl) / (3 * withinStDev);
                cpk = Math.min(cpu, cpl);
            }

            const skew = calculateSkewness(values, mean, stdDev);
            let normStatus = "Normal", normColor = "text-green-500";
            if (Math.abs(skew) > 1) { normStatus = "Skewed"; normColor = "text-red-500 font-bold"; } 
            else if (Math.abs(skew) > 0.5) { normStatus = "Moderate"; normColor = "text-yellow-500"; }
            
            stats.push({ cav: series, n, mean, min, max, stdDev, variance, cpk, normStatus, normColor, skew });
        }
        
        plotTraces.push({ 
            x: seriesData.map(p => p.sample), 
            y: values, 
            mode: 'lines+markers', 
            name: series, 
            visible: isVisible ? true : 'legendonly',
            line: { color: colors[idx % colors.length], width: 3, opacity: isLightMode ? 0.8 : 1 }, /* Changed width to 3, increased opacity */
            marker: { color: colors[idx % colors.length], size: 6, opacity: isLightMode ? 0.8 : 1 } 
        });
    });

    // Stats Banner
    const nAll = allFilteredValues.length;
    const statsBanner = document.getElementById('stdStatsBanner');
    if (nAll > 0) {
        const sumAll = allFilteredValues.reduce((a, b) => a + b, 0);
        const meanAll = sumAll / nAll;
        const statVarAll = allFilteredValues.reduce((a, b) => a + Math.pow(b - meanAll, 2), 0) / (nAll - 1 || 1);
        const stdDevAll = Math.sqrt(statVarAll);
        const minAll = Math.min(...allFilteredValues);
        const maxAll = Math.max(...allFilteredValues);
        const varianceAll = maxAll - minAll;

        let mrSumAll = 0, mrCountAll = 0;
        for (let i = 1; i < nAll; i++) {
            mrSumAll += Math.abs(allFilteredValues[i] - allFilteredValues[i-1]);
            mrCountAll++;
        }
        const withinStDevAll = mrCountAll > 0 ? (mrSumAll / mrCountAll) / 1.128 : stdDevAll;

        let cpkAll = 0;
        if (withinStDevAll > 0) {
            const cpu = (rec.usl - meanAll) / (3 * withinStDevAll);
            const cpl = (meanAll - rec.lsl) / (3 * withinStDevAll);
            cpkAll = Math.min(cpu, cpl);
        }

        document.getElementById('statMean').textContent = meanAll.toFixed(4);
        document.getElementById('statVar').textContent = varianceAll.toFixed(4);
        document.getElementById('statCount').textContent = `${nAll} Samples | ${activeSeriesFilter.size} Series`;
        const cpkEl = document.getElementById('statCpk');
        cpkEl.textContent = cpkAll.toFixed(2);
        cpkEl.className = cpkAll >= targetCpk ? "font-mono font-bold text-xl text-accent-success" : "font-mono font-bold text-xl text-accent-danger";
        statsBanner.classList.remove('hidden');
        statsBanner.classList.add('flex');
        
        const skewAll = calculateSkewness(allFilteredValues, meanAll, stdDevAll);
        let normStatusAll = "Normal", normColorAll = "text-green-500";
        if (Math.abs(skewAll) > 1) { normStatusAll = "Skewed"; normColorAll = "text-red-500 font-bold"; } 
        else if (Math.abs(skewAll) > 0.5) { normStatusAll = "Moderate"; normColorAll = "text-yellow-500"; }
        stats.unshift({ cav: `ALL (${activeSeriesFilter.size})`, n: nAll, mean: meanAll, min: minAll, max: maxAll, stdDev: stdDevAll, variance: varianceAll, cpk: cpkAll, normStatus: normStatusAll, normColor: normColorAll, skew: skewAll, isTotal: true });
    } else {
        statsBanner.classList.add('hidden');
        statsBanner.classList.remove('flex');
    }

    renderTable(stats);

    // Chart Layout
    const allY = plotTraces.flatMap(t => t.y); allY.push(rec.usl, rec.lsl);
    const MathRange = Math.max(...allY) - Math.min(...allY);
    
    const chartRef = getChartRefColors(isLightMode);
    const bgColor = getThemeVar('--sl-800', isLightMode ? '#ffffff' : '#0f172a');
    const plotColor = isLightMode ? chartRef.plotBg : getThemeVar('--sl-850', '#1e293b');
    const fontColor = getThemeVar('--sl-100', isLightMode ? '#0f172a' : '#e2e8f0');
    const gridColor = chartRef.grid;

    const axisLine = isLightMode ? {} : { showline: false };
    const layout = {
        margin: { t: 60, r: 50, l: 80, b: 50 }, 
        title: { text: `<b>${getFullDimensionName(rec)}</b>`, font: { size: 16, color: isLightMode ? '#0f172a' : '#e2e8f0' }, y: 0.95 },
        xaxis: { title: 'Sample Sequence', gridcolor: gridColor, color: fontColor, tickmode: 'linear', dtick: 1, ...axisLine },
        yaxis: { title: `Measured Value ${unit ? '('+unit+')' : ''}`, automargin: true, gridcolor: gridColor, color: fontColor, range: [Math.min(...allY) - (MathRange*0.1), Math.max(...allY) + (MathRange*0.1)], ...axisLine },
        plot_bgcolor: plotColor, paper_bgcolor: bgColor, 
        font: { family: 'Segoe UI, sans-serif', color: fontColor },
        showlegend: false, hoverlabel: { namelength: -1, font: { size: 12 } }, 
        shapes: [
            { type: 'line', y0: rec.usl, y1: rec.usl, x0: 0, x1: 1, xref: 'paper', line: { color: chartRef.limit, width: 2, dash: 'dash' } },
            { type: 'line', y0: rec.lsl, y1: rec.lsl, x0: 0, x1: 1, xref: 'paper', line: { color: chartRef.limit, width: 2, dash: 'dash' } },
            { type: 'line', y0: rec.nominal, y1: rec.nominal, x0: 0, x1: 1, xref: 'paper', line: { color: chartRef.nominal, width: 2 } }
        ]
    };

    renderCustomLegend(plotTraces, seriesList);
    
    setTimeout(() => {
        const chartDiv = document.getElementById('chart');
        layout.width = chartDiv.parentElement.clientWidth; 
        Plotly.newPlot('chart', plotTraces, layout, {responsive: true, displayModeBar: false}).then(() => { Plotly.Plots.resize('chart'); applyThemeToCharts(); });
    }, 15); 
}
export function renderCustomLegend(traces, allSeriesList) {
    const legendContainer = document.getElementById('custom-legend');
    const itemsContainer = document.getElementById('custom-legend-items');

    if (!traces || traces.length === 0) {
        legendContainer.classList.add('hidden');
        return;
    }

    legendContainer.classList.remove('hidden');
    legendContainer.classList.add('flex');
    itemsContainer.innerHTML = '';
    
    traces.forEach((trace, index) => {
        const color = trace.line.color;
        const name = trace.name;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center gap-2 legend-item p-1 hover:bg-slate-800 hover:text-white rounded transition-colors overflow-hidden';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = activeSeriesFilter.has(name); 
        cb.className = 'w-3.5 h-3.5 text-blue-600 bg-slate-800 border-slate-500 rounded focus:ring-blue-600 cursor-pointer shrink-0';
        
        cb.onchange = (e) => {
          globalThis.handleSeriesFilterChange?.(name, e.target.checked, allSeriesList);
        };

        const swatch = document.createElement('span');
        swatch.className = 'w-3 h-3 rounded-full inline-block flex-shrink-0 shadow-sm border border-slate-700';
        swatch.style.backgroundColor = color;

        const label = document.createElement('label');
        label.className = 'text-[11px] text-slate-400 font-medium cursor-pointer truncate select-none flex-grow transition-colors';
        label.textContent = name;
        label.title = name;
        label.onclick = () => { cb.click(); };

        itemDiv.appendChild(cb); itemDiv.appendChild(swatch); itemDiv.appendChild(label); itemsContainer.appendChild(itemDiv);
    });
}
window.toggleAllLegendTraces = function() {
    const anyChecked = activeSeriesFilter.size > 0;
    const allTraceNames = [];
    document.querySelectorAll('#custom-legend-items label').forEach(l => allTraceNames.push(l.textContent));
    globalThis.handleSeriesFilterChange?.("ALL", !anyChecked, allTraceNames);
};
// ==========================================
// RENDER HELPERS
// ==========================================
export function renderTable(stats) {
    const tbody = document.getElementById("statsTableBody"); 
    const targetCpk = parseFloat(document.getElementById('targetCpkInput').value) || 1.33; 
    tbody.innerHTML = "";
    stats.forEach(s => {
        const cpkColor = s.cpk >= targetCpk ? "text-accent-success font-bold" : "text-accent-danger font-bold";
        const tr = document.createElement('tr');
        // Adds zebra striping and removes heavy borders
        tr.className = s.isTotal 
            ? "bg-slate-750 hover:bg-slate-700 transition-colors font-bold border-l-4 border-l-[var(--accent-primary)]" 
            : "bg-slate-800 hover:bg-slate-750 transition-colors border-b border-slate-700/30 even:bg-[rgba(0,0,0,0.1)]";
        
        tr.innerHTML = `
            <td class="px-6 py-3 text-left font-medium text-slate-200">${s.cav}</td>
            <td class="px-6 py-3 text-right text-slate-400 font-mono">${s.n}</td>
            <td class="px-6 py-3 text-right font-mono text-slate-300">${s.mean.toFixed(4)}</td>
            <td class="px-6 py-3 text-right font-mono text-slate-500">${s.min.toFixed(4)} - ${s.max.toFixed(4)}</td>
            <td class="px-6 py-3 text-right font-mono text-slate-400">${s.stdDev.toFixed(4)}</td>
            <td class="px-6 py-3 text-right font-mono text-slate-400">${s.variance.toFixed(4)}</td>
            <td class="px-6 py-3 text-right ${cpkColor}">${s.cpk.toFixed(2)}</td>
            <td class="px-6 py-3 text-left"><span class="${s.normColor} uppercase tracking-wide font-bold text-[10px]">${s.normStatus}</span><span class="text-xs text-slate-500 block">Skew: ${s.skew.toFixed(2)}</span></td>`;
        tbody.appendChild(tr);
    });
}
// ==========================================
// LIGHT MODE & THEME LOGIC
// ==========================================
export function initThemeFromStorage() {
    const light = readStoredThemeIsLight();
    document.body.classList.toggle('light-mode', light);
    isLightMode = light;
    syncThemeToggleButtons();
}

function syncThemeToggleButtons() {
    const btns = document.querySelectorAll('button[onclick="toggleLightMode()"]');
    btns.forEach(btn => {
        if (isLightMode) {
            btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            btn.title = 'Dark Mode';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            btn.title = 'Light Mode';
        }
    });
}

export function toggleLightMode() {
    isLightMode = !isLightMode;
    document.body.classList.toggle('light-mode', isLightMode);
    persistThemeIsLight(isLightMode);
    syncThemeToggleButtons();

    // Force Re-Render 
    if (currentTab === "standard") {
        globalThis.updateDashboard?.();
    } else if (currentTab === "sixpack") {
        globalThis.updateSixPack?.();
    }
    
    // Apply Theme explicitly once for both light and dark states
    setTimeout(() => {
        applyThemeToCharts();
    }, 50);
}

export function applyThemeToCharts() {
    const chartRef = getChartRefColors(isLightMode);
    const paperColor = getThemeVar('--sl-800', isLightMode ? '#ffffff' : '#0f172a');
    const plotColor = isLightMode ? chartRef.plotBg : getThemeVar('--sl-850', '#1e293b');
    const fontColor = getThemeVar('--sl-100', isLightMode ? '#0f172a' : '#e2e8f0');
    const gridColor = chartRef.grid;

    const updateObj = {
        'plot_bgcolor': plotColor,
        'paper_bgcolor': paperColor,
        'font.color': fontColor,
        'title.font.color': fontColor,
        'legend.font.color': fontColor,
        'xaxis.gridcolor': gridColor,
        'yaxis.gridcolor': gridColor,
        'xaxis.tickfont.color': fontColor,
        'yaxis.tickfont.color': fontColor,
        'xaxis.showline': isLightMode,
        'yaxis.showline': isLightMode,
    };

    document.querySelectorAll('.js-plotly-plot').forEach(chartEl => {
        if (chartEl.data) {
            const updateTraces = { 'line.width': 3 }; 
            Plotly.update(chartEl, updateTraces, updateObj).catch(() => {});
        } else {
            Plotly.relayout(chartEl, updateObj).catch(() => {});
        }
    });
}
