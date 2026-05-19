import { D2_CONSTANTS } from "../constants.js";
import { getBaseLayout } from "./plotly-layout.js";
import { isLightMode } from "../state.js";
import { getChartRefColors, getThemeVar } from "../theme.js";

function chartColors() {
    const ref = getChartRefColors(isLightMode);
    return {
        primary: getThemeVar('--accent-primary', '#3b82f6'),
        limit: ref.limit,
        nominal: ref.nominal,
        accent: getThemeVar('--accent-purple', '#a855f7'),
    };
}

export function renderControlCharts(type, groups, grandMean, sigma, subSize, outlierSet) { 
    const c = chartColors();
    const labels = groups.map(g => g.id); 
    const xData = groups.map(g => g.mean); 
    
    const pointColors = groups.map(g => {
        if(subSize === 1 && g.ids && g.ids.length > 0) {
            return outlierSet.has(g.ids[0]) ? c.limit : c.primary;
        }
        return c.primary;
    });

    let ucl, lcl, uclR, rData, rBar;
    if (subSize > 1) { 
        const limits = 3 * (sigma / Math.sqrt(subSize));
        ucl = grandMean + limits; lcl = grandMean - limits;
        const d2 = D2_CONSTANTS[Math.min(subSize, 16)] || Math.sqrt(subSize);
        const d4 = {2:3.267, 3:2.574, 4:2.282, 5:2.114}[subSize] || 2.114;
        rBar = sigma * d2; rData = groups.map(g => g.range); uclR = rBar * d4;
    } else { 
        ucl = grandMean + 3 * sigma; lcl = grandMean - 3 * sigma;
        const d2 = 1.128; const mrBar = sigma * d2;
        rData = groups.map(g => g.mr || 0);
        rBar = mrBar; uclR = 3.267 * mrBar;
    }

    const trace1 = { x: labels, y: xData, type: 'scatter', mode: 'lines+markers', line: {color: c.primary, width: 1}, marker: {color: pointColors, size: 6} };
    const shapeUCL = { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: ucl, y1: ucl, line: {color: c.limit, dash:'dash', width:1} }; 
    const shapeLCL = { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: lcl, y1: lcl, line: {color: c.limit, dash:'dash', width:1} }; 
    const shapeCL = { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: grandMean, y1: grandMean, line: {color: c.nominal, width:1} }; 
    
    const base = getBaseLayout();
    Plotly.newPlot('spChart1', [trace1], { ...base, title: { text: type === 'XbarR' ? 'Xbar Chart' : 'I Chart', font: {color: base.titleFontColor} }, shapes: [shapeUCL, shapeLCL, shapeCL] }, {responsive: true, displayModeBar:false});
    
    const trace2 = { x: labels, y: rData, type: 'scatter', mode: 'lines+markers', marker: {color:'#f59e0b', size:4}, line: {width:1} }; 
    const rShapeUCL = { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: uclR, y1: uclR, line: {color: c.limit, dash:'dash', width:1} }; 
    const rShapeCL = { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: rBar, y1: rBar, line: {color: c.nominal, width:1} }; 
    Plotly.newPlot('spChart2', [trace2], { ...base, title: { text: type === 'XbarR' ? 'R Chart' : 'MR Chart', font: {color: base.titleFontColor} }, shapes: [rShapeUCL, rShapeCL] }, {responsive: true, displayModeBar:false}); 
}

export function renderRunChart(groups, mean, usl, lsl, outlierSet) { 
    const c = chartColors();
    let flatY = []; let flatColors = [];
    groups.forEach(g => { 
        const values = Array.isArray(g.values) ? g.values : [g.mean];
        const ids = Array.isArray(g.ids) ? g.ids : [];
        values.forEach((v, i) => {
            flatY.push(v);
            const id = ids[i];
            if (id !== undefined && outlierSet && outlierSet.has(id)) { flatColors.push(c.limit); } 
            else { flatColors.push(c.accent); }
        });
    }); 
    
    const trace = { y: flatY, type: 'scatter', mode: 'lines+markers', line: {color: c.accent, width: 1}, marker: {color: flatColors, size: 5} }; 
    const shapes = [ 
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: mean, y1: mean, line: {color: c.nominal, width:1} }, 
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: usl, y1: usl, line: {color: c.limit, width: 2, dash: 'dash'} }, 
        { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: lsl, y1: lsl, line: {color: c.limit, width: 2, dash: 'dash'} } 
    ]; 
    const allY = [...flatY, usl, lsl]; 
    const minY = Math.min(...allY); const maxY = Math.max(...allY); const padding = (maxY - minY) * 0.1; 
    
    const base = getBaseLayout();
    Plotly.newPlot('spChart3', [trace], { ...base, title: { text: 'Run Chart (All Obs)', font: {color: base.titleFontColor} }, shapes: shapes, yaxis: { gridcolor: base.xaxis.gridcolor, range: [minY - padding, maxY + padding] } }, {responsive: true, displayModeBar:false}); 
}

export function renderHistogram(data, mean, stdevOverall, stdevWithin, lsl, usl) { 
    const c = chartColors();
    const traceHist = { x: data, type: 'histogram', opacity: 0.6, marker: {color: c.primary}, name: 'Data', histnorm: 'probability density' }; 
    const allValues = [...data, lsl, usl]; 
    const minVal = Math.min(...allValues); const maxVal = Math.max(...allValues); 
    const range = maxVal - minVal; const xMin = minVal - (range * 0.1); const xMax = maxVal + (range * 0.1); 
    const xGrid = jStat.seq(xMin, xMax, 200); 
    
    let yWithin = []; if(stdevWithin > 0) yWithin = xGrid.map(x => jStat.normal.pdf(x, mean, stdevWithin)); 
    const traceWithin = { x: xGrid, y: yWithin, type: 'scatter', mode: 'lines', line: {color: c.limit, width:2}, name: 'Within' }; 
    
    let yOverall = []; if(stdevOverall > 0) yOverall = xGrid.map(x => jStat.normal.pdf(x, mean, stdevOverall)); 
    const traceOverall = { x: xGrid, y: yOverall, type: 'scatter', mode: 'lines', line: {color: c.primary, width:2, dash:'dot'}, name: 'Overall' }; 
    
    const shapes = [ { type: 'line', y0: 0, y1: 1, yref: 'paper', x0: lsl, x1: lsl, line: {color: c.limit, width: 2, dash: 'dash'} }, { type: 'line', y0: 0, y1: 1, yref: 'paper', x0: usl, x1: usl, line: {color: c.limit, width: 2, dash: 'dash'} } ]; 
    
    const base = getBaseLayout();
    Plotly.newPlot('spChart4', [traceHist, traceWithin, traceOverall], { ...base, title: { text: 'Capability Histogram', font: {color: base.titleFontColor} }, showlegend: true, legend: {x:0, y:1, font:{size:8, color: base.titleFontColor}}, shapes: shapes, xaxis: { gridcolor: base.xaxis.gridcolor, range: [xMin, xMax] } }, {responsive: true, displayModeBar:false}); 
}

export function renderProbPlot(data, adStats) {
    const c = chartColors();
    const sorted = [...data].sort((a,b)=>a-b); const n = sorted.length; 
    const mean = jStat.mean(data); const sd = jStat.stdev(data, true); 
    const lineX = [mean - 3*sd, mean + 3*sd]; const lineY = [-3, 3]; 
    const Zscores = sorted.map((_, i) => jStat.normal.inv((i+0.375)/(n+0.25), 0, 1)); 
    
    const tracePoints = { x: sorted, y: Zscores, type: 'scatter', mode: 'markers', marker: {color: c.primary, size:4} }; 
    const traceLine = { x: lineX, y: lineY, type: 'scatter', mode: 'lines', line: {color: c.limit, width:1} }; 
    
    const base = getBaseLayout();
    Plotly.newPlot('spChart5', [tracePoints, traceLine], { ...base, title: { text: 'Normal Prob Plot (AD)', font: {color: base.titleFontColor} }, yaxis: { title: 'Z-Score', gridcolor: base.xaxis.gridcolor }, annotations: [ { x: 0.05, y: 0.95, xref: 'paper', yref: 'paper', text: `AD: ${adStats.A2.toFixed(3)}`, showarrow: false, font:{size:9, color: base.titleFontColor}, xanchor:'left' }, { x: 0.05, y: 0.88, xref: 'paper', yref: 'paper', text: `P-Val: ${adStats.p.toFixed(3)}`, showarrow: false, font:{size:9, color: base.titleFontColor}, xanchor:'left' } ] }, {responsive: true, displayModeBar:false}); 
}

export function renderStatsPanel(
  Cp,
  Cpk,
  Pp,
  Ppk,
  mean,
  overallSd,
  withinSd,
  adStats,
  N,
  lsl,
  usl,
  nominal,
  ppkIsPercentile = false,
  Pp_Norm,
  Ppk_Norm
) { 
    const div = document.getElementById('spStats'); 
    const targetCpk = parseFloat(document.getElementById('targetCpkInput').value) || 1.33; 
    const cpkColor = Cpk >= targetCpk ? "text-accent-success" : "text-accent-danger"; 
    const helpKey = ppkIsPercentile ? 'ppk_percentile' : 'cap';
    let ppkDisplay = "", ppTag = "", headerButton = ""; 
    if (ppkIsPercentile) {
        ppkDisplay = `<div class="flex flex-col"><div class="flex items-center gap-2"><span class="text-2xl font-bold text-blue-400">${Ppk.toFixed(2)}</span><span class="text-[10px] text-blue-300 border border-blue-500 px-1 rounded">PERCENTILE</span><button onclick="showChartHelp('${helpKey}')" class="text-orange-500 hover:text-orange-400 focus:outline-none animate-pulse" title="Why Percentile?"><i class="fa-solid fa-circle-question text-lg"></i></button></div><div class="text-[10px] text-slate-500">(Normal: ${Ppk_Norm.toFixed(2)})</div></div>`;
        ppTag = `<span class="text-[10px] text-slate-500 ml-1">(Norm: ${Pp_Norm.toFixed(2)})</span>`;
        headerButton = "";
    } else {
        ppkDisplay = `<span class="text-2xl font-bold ${Ppk >= targetCpk ? 'text-accent-success' : 'text-accent-danger'}">${Ppk.toFixed(2)}</span>`;
        headerButton = `<button onclick="showChartHelp('${helpKey}')" class="text-slate-500 hover:text-blue-400 transition-colors focus:outline-none" title="Show Explanation"><i class="fa-solid fa-circle-question text-sm"></i></button>`;
    }
    div.innerHTML = `<div class="grid grid-cols-2 gap-x-2 text-xs text-slate-300"><div class="col-span-2 grid grid-cols-4 gap-2 mb-2"><span>LSL: ${lsl.toFixed(3)}</span><span>USL: ${usl.toFixed(3)}</span><span>Mean: ${mean.toFixed(3)}</span><span>N: ${N}</span></div><hr class="col-span-2 border-slate-700 mb-2"><div class="flex flex-col space-y-1"><span class="text-blue-400 font-semibold underline">Within (Potential)</span><span>StDev: ${withinSd.toFixed(4)}</span><span>Cp: ${Cp.toFixed(2)}</span><div class="mt-2"><span class="text-xs font-bold text-slate-500">Cpk</span><div class="text-3xl font-bold ${cpkColor}">${Cpk.toFixed(2)}</div></div></div><div class="flex flex-col space-y-1"><span class="text-blue-400 font-semibold underline">Overall (Actual)</span><span>StDev: ${overallSd.toFixed(4)}</span><span class="flex items-center">Pp: ${Pp.toFixed(2)} ${ppTag}</span><div class="mt-2"><div class="flex items-center justify-between"><span class="text-xs font-bold text-slate-500">Ppk</span>${headerButton}</div>${ppkDisplay}</div><div class="mt-2 border-t border-slate-700 pt-1"><span class="text-xs font-bold text-slate-500">AD Normality Test</span><div class="flex items-baseline gap-2"><div class="text-xl font-bold ${adStats.p < 0.05 ? 'text-accent-danger' : 'text-accent-success'}">P: ${adStats.p.toFixed(3)}</div><span class="text-[10px] text-slate-500">AD: ${adStats.A2.toFixed(2)}</span></div></div></div></div>`; 
    const c6 = chartColors();
    const traceSpec = { x: [lsl, usl], y: [1, 1], type: 'scatter', mode: 'lines+markers', name: 'Specs', line: {color: c6.limit, width:4}, marker:{symbol:'line-ns-open', size:10, color: c6.limit} }; 
    const traceProcess = { x: [mean - 3*withinSd, mean + 3*withinSd], y: [0.5, 0.5], type: 'scatter', mode: 'lines+markers', name: 'Process', line: {color: c6.primary, width:4}, marker:{symbol:'line-ns-open', size:10, color: c6.primary} }; 
    const traceNom = { x: [nominal], y: [1], type:'scatter', mode:'markers', marker:{color: c6.nominal, symbol:'cross', size:8} }; 
    const base = getBaseLayout();
    Plotly.newPlot('spChart6', [traceSpec, traceProcess, traceNom], { margin: { t: 30, r: 20, l: 40, b: 30 }, font: { size: 10, family: 'Segoe UI', color: base.font.color }, showlegend: false, plot_bgcolor: base.plot_bgcolor, paper_bgcolor: base.paper_bgcolor, xaxis: { gridcolor: base.xaxis.gridcolor }, yaxis: { showticklabels: false, range: [0, 2], gridcolor: base.yaxis.gridcolor }, title: { text: 'Capability Interval', font: {color: base.titleFontColor} } }, {responsive: true, displayModeBar:false});
}
