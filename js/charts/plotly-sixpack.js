import { D2_CONSTANTS } from "../constants.js";
import { getBaseLayout } from "./plotly-layout.js";
import { isLightMode } from "../state.js";
import { getChartRefColors, getThemeVar } from "../theme.js";
import { plotSixPackChart } from "./plotly-sixpack-utils.js";
import { METHOD_IDS } from "../analysis/capability-methods.js";
import { getNormalityPSeverity } from "../analysis/minitab-guide.js";

function sixPackPlotMargin(base, extra = {}) {
  return { ...base.margin, t: 12, ...extra };
}

function updateSpChartTitle(chartNum, text) {
  const el = document.getElementById(`spChart${chartNum}-title`);
  if (el) el.textContent = text;
}

function chartColors() {
  const ref = getChartRefColors(isLightMode);
  return {
    primary: getThemeVar('--accent-primary', '#3b82f6'),
    limit: ref.limit,
    nominal: ref.nominal,
    accent: getThemeVar('--accent-purple', '#a855f7'),
  };
}

function methodBadgeHtml(meta) {
  if (!meta || (meta.methodId === METHOD_IDS.PARAMETRIC && !meta.showReferenceNorm && !meta.nonNormalWarning))
    return { ppkDisplay: null, ppTag: "", helpKey: "cap", headerButton: "" };
  if (meta.methodId === METHOD_IDS.PARAMETRIC && meta.nonNormalWarning) {
    const sev = getNormalityPSeverity(meta.rawAdP);
    return {
      helpKey: "cap_parametric",
      ppTag: "",
      headerButton: "",
      ppkDisplay: (Ppk, colorClass) => `<div class="flex flex-col"><div class="flex items-center gap-2"><span class="text-2xl font-bold ${colorClass}">${Ppk.toFixed(2)}</span><span class="text-[10px] px-1 rounded ${sev.badgeClass}">${sev.label}</span></div><div class="text-[10px] text-slate-500">Select a method in the panel above.</div></div>`,
    };
  }
  const targetCpk = parseFloat(document.getElementById('targetCpkInput')?.value) || 1.33;
  const helpKey = meta.helpKey || "cap";
  let badge = "";
  if (meta.methodId === METHOD_IDS.PERCENTILE) badge = "PERCENTILE";
  else if (meta.methodId === METHOD_IDS.BOXCOX) badge = "BOX-COX";
  else if (meta.methodId === METHOD_IDS.JOHNSON) badge = "JOHNSON";
  else if (meta.methodId === METHOD_IDS.TAYLOR) badge = meta.taylor?.met ? "TAYLOR OK" : "TAYLOR";
  else if (meta.isTransformed) badge = "TRANSFORMED";

  const refLine =
    meta.showReferenceNorm && meta.Ppk_Norm != null
      ? `<div class="text-[10px] text-slate-500">(Parametric: Ppk ${meta.Ppk_Norm.toFixed(2)}, Pp ${meta.Pp_Norm.toFixed(2)})</div>`
      : "";
  const rawLine =
    meta.rawAdP != null && meta.isTransformed
      ? `<div class="text-[10px] text-slate-500">Raw AD P: ${meta.rawAdP.toFixed(3)} · Transformed: ${(meta.transformedAdP ?? 0).toFixed(3)}</div>`
      : "";

  return {
    helpKey,
    ppTag:
      meta.showReferenceNorm && meta.Pp_Norm != null
        ? `<span class="text-[10px] text-slate-500 ml-1">(Param: ${meta.Pp_Norm.toFixed(2)})</span>`
        : "",
    headerButton: "",
    ppkDisplay: (Ppk, colorClass) => `<div class="flex flex-col"><div class="flex items-center gap-2"><span class="text-2xl font-bold ${colorClass}">${Ppk.toFixed(2)}</span>${badge ? `<span class="text-[10px] text-blue-300 border border-blue-500 px-1 rounded">${badge}</span>` : ""}</div>${refLine}${rawLine}${meta.transformLabel ? `<div class="text-[10px] text-slate-500">${meta.transformLabel}</div>` : ""}</div>`,
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
  const title1 = type === 'XbarR' ? 'Xbar Chart' : 'I Chart';
  const title2 = type === 'XbarR' ? 'R Chart' : 'MR Chart';
  updateSpChartTitle(1, title1);
  updateSpChartTitle(2, title2);
  const p1 = plotSixPackChart('spChart1', [trace1], { ...base, margin: sixPackPlotMargin(base), shapes: [shapeUCL, shapeLCL, shapeCL] });
  
  const trace2 = { x: labels, y: rData, type: 'scatter', mode: 'lines+markers', marker: {color:'#f59e0b', size:4}, line: {width:1} }; 
  const rShapeUCL = { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: uclR, y1: uclR, line: {color: c.limit, dash:'dash', width:1} }; 
  const rShapeCL = { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: rBar, y1: rBar, line: {color: c.nominal, width:1} }; 
  const p2 = plotSixPackChart('spChart2', [trace2], { ...base, margin: sixPackPlotMargin(base), shapes: [rShapeUCL, rShapeCL] });
  return Promise.all([p1, p2]);
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
  return plotSixPackChart('spChart3', [trace], { ...base, margin: sixPackPlotMargin(base), shapes: shapes, yaxis: { gridcolor: base.xaxis.gridcolor, range: [minY - padding, maxY + padding] } });
}

export function renderHistogram(data, mean, stdevOverall, stdevWithin, lsl, usl, methodMeta = null) { 
  const c = chartColors();
  const title = methodMeta?.isTransformed
    ? `Histogram (${methodMeta.transformLabel || "Transformed"})`
    : "Capability Histogram";
  updateSpChartTitle(4, title);

  const allValues = [...data, lsl, usl];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal;
  const xMin = minVal - range * 0.1;
  const xMax = maxVal + range * 0.1;
  const xGrid = jStat.seq(xMin, xMax, 200);

  const binCount = Math.min(30, Math.max(8, Math.ceil(Math.sqrt(data.length))));
  const span = xMax - xMin;
  const binW = span > 0 ? span / binCount : 1;

  const traceHist = {
    x: data,
    type: 'histogram',
    opacity: 0.6,
    marker: { color: c.primary },
    name: 'Data',
    histnorm: 'probability density',
    xbins: { start: xMin, end: xMax, size: binW },
  };

  let yWithin = [];
  if (stdevWithin > 0) yWithin = xGrid.map((x) => jStat.normal.pdf(x, mean, stdevWithin));
  const traceWithin = { x: xGrid, y: yWithin, type: 'scatter', mode: 'lines', line: { color: c.limit, width: 2 }, name: 'Within' };

  let yOverall = [];
  if (stdevOverall > 0) yOverall = xGrid.map((x) => jStat.normal.pdf(x, mean, stdevOverall));
  const traceOverall = {
    x: xGrid,
    y: yOverall,
    type: 'scatter',
    mode: 'lines',
    line: { color: c.primary, width: 2, dash: 'dot' },
    name: 'Overall',
  };

  let yMax = 0.01;
  for (const y of yWithin) if (y > yMax) yMax = y;
  for (const y of yOverall) if (y > yMax) yMax = y;
  if (stdevOverall > 0) {
    yMax = Math.max(yMax, jStat.normal.pdf(mean, mean, stdevOverall));
  }
  if (stdevWithin > 0) {
    yMax = Math.max(yMax, jStat.normal.pdf(mean, mean, stdevWithin));
  }
  if (span > 0 && data.length > 0) {
    for (let b = 0; b < binCount; b++) {
      const lo = xMin + b * binW;
      const hi = lo + binW;
      const count = data.filter((v) => v >= lo && (b === binCount - 1 ? v <= hi : v < hi)).length;
      const dens = count / (data.length * binW);
      if (dens > yMax) yMax = dens;
    }
  }
  const yTop = yMax * 1.28;

  const shapes = [
    { type: 'line', y0: 0, y1: 1, yref: 'paper', x0: lsl, x1: lsl, line: { color: c.limit, width: 2, dash: 'dash' } },
    { type: 'line', y0: 0, y1: 1, yref: 'paper', x0: usl, x1: usl, line: { color: c.limit, width: 2, dash: 'dash' } },
  ];

  const base = getBaseLayout();
  const legendColor = base.titleFontColor;
  return plotSixPackChart('spChart4', [traceHist, traceWithin, traceOverall], {
    ...base,
    margin: sixPackPlotMargin(base, { t: 6, b: 28, l: 48, r: 12 }),
    showlegend: true,
    legend: {
      orientation: 'h',
      x: 1,
      y: 1,
      xanchor: 'right',
      yanchor: 'top',
      font: { size: 8, color: legendColor },
      bgcolor: 'rgba(0,0,0,0)',
      borderwidth: 0,
    },
    shapes,
    xaxis: {
      domain: [0, 1],
      anchor: 'y',
      gridcolor: base.xaxis.gridcolor,
      range: [xMin, xMax],
      automargin: true,
    },
    yaxis: {
      domain: [0, 1],
      gridcolor: base.yaxis.gridcolor,
      rangemode: 'tozero',
      range: [0, yTop],
      automargin: true,
      fixedrange: false,
    },
  });
}

export function renderProbPlot(data, normStats, methodMeta = null) {
  const c = chartColors();
  const testLabel = normStats?.testLabel || "Anderson-Darling";
  const testTag = normStats?.statLabel || "AD";
  const title = methodMeta?.isTransformed
    ? `Normal Prob Plot (${methodMeta.transformLabel || "Transformed"})`
    : `Normal Prob Plot (${testTag})`;
  updateSpChartTitle(5, title);

  const sorted = [...data].sort((a,b)=>a-b); const n = sorted.length; 
  const mean = jStat.mean(data); const sd = jStat.stdev(data, true); 
  const lineX = [mean - 3*sd, mean + 3*sd]; const lineY = [-3, 3]; 
  const Zscores = sorted.map((_, i) => jStat.normal.inv((i+0.375)/(n+0.25), 0, 1)); 
  const pass = normStats?.p != null && normStats.p >= 0.05;
  const statVal = (normStats?.statistic ?? normStats?.A2 ?? 0).toFixed(3);
  const pText = normStats?.p != null ? normStats.p.toFixed(3) : "—";
  
  const tracePoints = { x: sorted, y: Zscores, type: 'scatter', mode: 'markers', marker: {color: c.primary, size:4} }; 
  const traceLine = { x: lineX, y: lineY, type: 'scatter', mode: 'lines', line: {color: c.limit, width:1} }; 
  
  const base = getBaseLayout();
  return plotSixPackChart('spChart5', [tracePoints, traceLine], {
    ...base,
    margin: sixPackPlotMargin(base, { t: 28, b: 28, l: 52, r: 12 }),
    yaxis: { title: 'Z-Score', gridcolor: base.xaxis.gridcolor, automargin: true },
    annotations: [
      { x: 0.05, y: 0.95, xref: 'paper', yref: 'paper', text: `${testLabel} · ${testTag}: ${statVal}`, showarrow: false, font: { size: 9, color: base.titleFontColor }, xanchor: 'left' },
      { x: 0.05, y: 0.88, xref: 'paper', yref: 'paper', text: `P = ${pText} (${pass ? "pass" : "fail"} @ 0.05)`, showarrow: false, font: { size: 9, color: pass ? '#22c55e' : base.titleFontColor }, xanchor: 'left' },
      { x: 0.05, y: 0.81, xref: 'paper', yref: 'paper', text: 'Points unchanged; test updates P-value only', showarrow: false, font: { size: 8, color: base.titleFontColor }, xanchor: 'left' },
    ],
  });
}

export function renderStatsPanel(
  Cp,
  Cpk,
  Pp,
  Ppk,
  mean,
  overallSd,
  withinSd,
  normStats,
  N,
  lsl,
  usl,
  nominal,
  methodMeta = null,
  rawAdStats = null
) { 
    const div = document.getElementById('spStats'); 
    const targetCpk = parseFloat(document.getElementById('targetCpkInput').value) || 1.33; 
    const cpkColor = Cpk >= targetCpk ? "text-accent-success" : "text-accent-danger";
    const ppkColor = Ppk >= targetCpk ? "text-blue-400" : "text-accent-danger";
    const badge = methodBadgeHtml(methodMeta);
    let ppkDisplay;
    if (badge.ppkDisplay) {
      ppkDisplay = badge.ppkDisplay(Ppk, ppkColor);
    } else {
      ppkDisplay = `<span class="text-2xl font-bold ${ppkColor}">${Ppk.toFixed(2)}</span>`;
    }
    const ppTag = badge.ppTag || "";
    const methodLine = methodMeta?.methodLabel
      ? `<div class="col-span-2 text-[10px] text-slate-500 mb-1">Overall method: <span class="text-slate-300">${methodMeta.methodLabel}</span></div>`
      : "";
    const rawAdLine =
      rawAdStats && methodMeta?.isTransformed
        ? `<span class="text-[10px] text-slate-500 block">Raw AD P: ${rawAdStats.p.toFixed(3)}</span>`
        : "";

    const testLabel = normStats?.testLabel || "Anderson-Darling";
    const statLabel = normStats?.statLabel || "AD";
    const statVal = normStats?.statistic ?? normStats?.A2 ?? 0;
    div.innerHTML = `<div class="grid grid-cols-2 gap-x-2 text-xs text-slate-300">${methodLine}<div class="col-span-2 grid grid-cols-4 gap-2 mb-2"><span>LSL: ${lsl.toFixed(3)}</span><span>USL: ${usl.toFixed(3)}</span><span>Mean: ${mean.toFixed(3)}</span><span>N: ${N}</span></div><hr class="col-span-2 border-slate-700 mb-2"><div class="flex flex-col space-y-1"><span class="text-blue-400 font-semibold underline">Within (Potential)</span><span>StDev: ${withinSd.toFixed(4)}</span><span>Cp: ${Cp.toFixed(2)}</span><div class="mt-2"><span class="text-xs font-bold text-slate-500">Cpk</span><div class="text-3xl font-bold ${cpkColor}">${Cpk.toFixed(2)}</div></div></div><div class="flex flex-col space-y-1"><span class="text-blue-400 font-semibold underline">Overall (Actual)</span><span>StDev: ${overallSd.toFixed(4)}</span><span class="flex items-center">Pp: ${Pp.toFixed(2)} ${ppTag}</span><div class="mt-2"><span class="text-xs font-bold text-slate-500">Ppk</span>${ppkDisplay}</div><div class="mt-2 border-t border-slate-700 pt-1"><span class="text-xs font-bold text-slate-500">${testLabel}</span><div class="flex items-baseline gap-2"><div class="text-xl font-bold ${normStats.p < 0.05 ? 'text-accent-danger' : 'text-accent-success'}">P: ${normStats.p.toFixed(3)}</div><span class="text-[10px] text-slate-500">${statLabel}: ${statVal.toFixed(3)}</span></div>${rawAdLine}</div></div></div>`; 
    const c6 = chartColors();
    const traceSpec = { x: [lsl, usl], y: [1, 1], type: 'scatter', mode: 'lines+markers', name: 'Specs', line: {color: c6.limit, width:4}, marker:{symbol:'line-ns-open', size:10, color: c6.limit} }; 
    const traceProcess = { x: [mean - 3*withinSd, mean + 3*withinSd], y: [0.5, 0.5], type: 'scatter', mode: 'lines+markers', name: 'Process', line: {color: c6.primary, width:4}, marker:{symbol:'line-ns-open', size:10, color: c6.primary} }; 
    const traceNom = { x: [nominal], y: [1], type:'scatter', mode:'markers', marker:{color: c6.nominal, symbol:'cross', size:8} }; 
    const base = getBaseLayout();
    return plotSixPackChart('spChart6', [traceSpec, traceProcess, traceNom], { margin: { t: 30, r: 20, l: 40, b: 30 }, font: { size: 10, family: 'Segoe UI', color: base.font.color }, showlegend: false, plot_bgcolor: base.plot_bgcolor, paper_bgcolor: base.paper_bgcolor, xaxis: { gridcolor: base.xaxis.gridcolor }, yaxis: { showticklabels: false, range: [0, 2], gridcolor: base.yaxis.gridcolor }, title: { text: 'Capability Interval', font: {color: base.titleFontColor} } });
}
