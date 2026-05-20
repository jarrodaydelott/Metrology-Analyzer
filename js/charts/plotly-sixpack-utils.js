/* global Plotly */

export const SIX_PACK_CHART_IDS = [
  "spChart1",
  "spChart2",
  "spChart3",
  "spChart4",
  "spChart5",
  "spChart6",
];

const DEFAULT_CONFIG = { responsive: true, displayModeBar: false };

function plotWhenSized(el, plotFn) {
  const run = () => {
    if (el.clientWidth > 0 && el.clientHeight > 0) return plotFn();
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve(plotFn()));
      });
    });
  };
  return run();
}

export function plotSixPackChart(id, traces, layout, config = DEFAULT_CONFIG) {
  const el = document.getElementById(id);
  if (!el) return Promise.resolve();
  const h = el.clientHeight || 300;
  const w = el.clientWidth || undefined;
  layout = {
    ...layout,
    autosize: true,
    height: h,
    ...(w ? { width: w } : {}),
  };
  return plotWhenSized(el, () => {
    if (el.data) Plotly.purge(id);
    return Plotly.newPlot(id, traces, layout, config).then(() => Plotly.Plots.resize(id));
  });
}

export function resizeSixPackCharts() {
  SIX_PACK_CHART_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el?.layout) Plotly.Plots.resize(id);
  });
}

export function scheduleSixPackResize() {
  requestAnimationFrame(() => {
    resizeSixPackCharts();
    setTimeout(resizeSixPackCharts, 50);
  });
}
