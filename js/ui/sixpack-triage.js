/* global Plotly, jStat */

import {
  globalData,
  adjustments,
  ignoredIds,
  activeRunFilter,
  capabilityOptions,
  setCapabilityMethodState,
} from "../state.js";
import { METHOD_IDS } from "../analysis/capability-methods.js";
import { NORMALITY_TEST_IDS } from "../math/stats.js";
import { getCavityKey, getSeriesLabel, findCavitySelectOption } from "../utils/labels.js";
import { getBaseLayout } from "../charts/plotly-layout.js";

export const TRIAGE_GROUP_MODES = {
  CAVITY: "cavity",
  RUN: "run",
  CAVITY_RUN: "cavity_run",
};

let cavityTriageOpen = false;
let cavityTriageFullscreen = false;
let cavityTriageGroupMode = TRIAGE_GROUP_MODES.CAVITY;
const CAVITY_TRIAGE_PLOT_PREFIX = "sp-cavity-mini-";
let triageFullscreenEscHandler = null;

const TRIAGE_HINTS = {
  [TRIAGE_GROUP_MODES.CAVITY]:
    "One box plot per <strong class=\"text-slate-400\">physical cavity</strong> (all selected runs combined). Compare cavity-to-cavity imbalance. <strong class=\"text-slate-400\">Focus</strong> filters the six-pack to that cavity.",
  [TRIAGE_GROUP_MODES.RUN]:
    "One box plot per <strong class=\"text-slate-400\">production run</strong> (all cavities combined). See whether a specific run went off the rails. <strong class=\"text-slate-400\">Focus</strong> isolates that run with all cavities combined.",
  [TRIAGE_GROUP_MODES.CAVITY_RUN]:
    "Runs grouped under each <strong class=\"text-slate-400\">physical cavity</strong> — scroll within a band for runs, scroll the panel for cavities. Same synced Y-axis across all combos. <strong class=\"text-slate-400\">Focus</strong> opens that cavity × run in the six-pack.",
};

export function isCavityTriageOpen() {
  return cavityTriageOpen;
}

function purgeCavityTriagePlots() {
  document.querySelectorAll(`[id^="${CAVITY_TRIAGE_PLOT_PREFIX}"]`).forEach((el) => {
    if (el.id && el.data) Plotly.purge(el.id);
  });
}

function getCavityTriagePanel() {
  return document.getElementById("spCavityTriage");
}

function isCavityTriageFullscreenActive() {
  return getCavityTriagePanel()?.classList.contains("sp-cavity-triage-fullscreen") ?? false;
}

function getMiniPlotHeight() {
  return isCavityTriageFullscreenActive() ? 168 : 140;
}

function resizeCavityTriagePlots() {
  const h = getMiniPlotHeight();
  document.querySelectorAll(`[id^="${CAVITY_TRIAGE_PLOT_PREFIX}"]`).forEach((el) => {
    if (!el.id || !el.layout) return;
    Plotly.relayout(el.id, { height: h, width: el.clientWidth || undefined }).then(() => {
      Plotly.Plots.resize(el.id);
    });
  });
}

function syncTriageFullscreenButton() {
  const icon = document.getElementById("btn-triage-fullscreen-icon");
  const btn = document.getElementById("btn-triage-fullscreen");
  if (!icon) return;
  const on = isCavityTriageFullscreenActive();
  icon.classList.toggle("fa-expand", !on);
  icon.classList.toggle("fa-compress", on);
  if (btn) {
    btn.title = on ? "Exit fullscreen (Esc)" : "Expand fullscreen (Esc to exit)";
  }
}

function setCavityTriageFullscreen(on) {
  const panel = getCavityTriagePanel();
  if (!panel) return;
  cavityTriageFullscreen = on;
  panel.classList.toggle("sp-cavity-triage-fullscreen", on);
  document.body.classList.toggle("sp-cavity-triage-fs-lock", on);
  syncTriageFullscreenButton();
  if (triageFullscreenEscHandler) {
    document.removeEventListener("keydown", triageFullscreenEscHandler);
    triageFullscreenEscHandler = null;
  }
  if (on) {
    triageFullscreenEscHandler = (e) => {
      if (e.key === "Escape") toggleCavityTriageFullscreen(false);
    };
    document.addEventListener("keydown", triageFullscreenEscHandler);
  }
  requestAnimationFrame(() => {
    setTimeout(resizeCavityTriagePlots, 50);
  });
}

export function toggleCavityTriageFullscreen(force) {
  const panel = getCavityTriagePanel();
  if (!panel || panel.classList.contains("hidden")) return;
  const next = typeof force === "boolean" ? force : !isCavityTriageFullscreenActive();
  setCavityTriageFullscreen(next);
}

function escapeAttr(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function syncTriageGroupButtons() {
  document.querySelectorAll(".sp-triage-group-btn").forEach((btn) => {
    const active = btn.dataset.triageGroup === cavityTriageGroupMode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  const hint = document.getElementById("spCavityTriageHint");
  if (hint) hint.innerHTML = TRIAGE_HINTS[cavityTriageGroupMode] || "";
}

export function setCavityTriageGroup(mode) {
  if (!Object.values(TRIAGE_GROUP_MODES).includes(mode)) return;
  cavityTriageGroupMode = mode;
  syncTriageGroupButtons();
  if (cavityTriageOpen) renderCavityTriageGrid();
}

export function splitByCavityAndReAnalyze() {
  const cavSelect = document.getElementById("spCavSelect");
  if (!cavSelect) return;
  const firstCavity = Array.from(cavSelect.options).find((o) => o.value !== "all");
  if (!firstCavity) return;
  cavSelect.value = firstCavity.value;
  globalThis.resetAndUpdateSixPack?.();
}

export function applyRecommendedBoxCox() {
  const box = capabilityOptions.find((o) => o.id === METHOD_IDS.BOXCOX && o.applicable);
  if (!box) return;
  setCapabilityMethodState(METHOD_IDS.BOXCOX);
  globalThis.updateSixPack?.();
}

function buildRemediationButtons(ctx) {
  const { cavMode, isNormalByAD, isMultimodal, options } = ctx;
  const actions = [];
  if (!isNormalByAD && cavMode === "all" && isMultimodal) {
    actions.push({
      id: "btn-split-cavity",
      label: "📊 Split by Cavity & Re-Analyze",
      className:
        "sp-remediation-btn text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded shadow-sm transition-colors",
      onclick: "splitByCavityAndReAnalyze()",
    });
  }
  if (!isNormalByAD && cavMode !== "all") {
    const box = options?.find((o) => o.id === METHOD_IDS.BOXCOX && o.applicable);
    if (box) {
      actions.push({
        id: "btn-apply-boxcox",
        label: "✨ Apply Recommended Box-Cox",
        className:
          "sp-remediation-btn text-xs font-semibold bg-violet-700 hover:bg-violet-600 text-white px-3 py-1.5 rounded shadow-sm transition-colors",
        onclick: "applyRecommendedBoxCox()",
      });
    }
  }
  return actions;
}

export function renderSmartRemediationActions(ctx) {
  const container = document.getElementById("spRemediationActions");
  if (!container) return;
  const actions = buildRemediationButtons(ctx);
  if (actions.length === 0) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }
  container.innerHTML = actions
    .map(
      (a) =>
        `<button type="button" id="${a.id}" class="${a.className}" onclick="${a.onclick}">${a.label}</button>`,
    )
    .join("");
  container.classList.remove("hidden");
}

export function renderTriageNote(review) {
  const el = document.getElementById("spTriageNote");
  if (!el) return;
  const ad = review?.allTests?.[NORMALITY_TEST_IDS.ANDERSON_DARLING];
  const rj = review?.allTests?.[NORMALITY_TEST_IDS.RYAN_JOINER];
  const show = ad && rj && ad.p < 0.05 && rj.p >= 0.1;
  if (!show) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="flex gap-2 items-start">
    <i class="fa-solid fa-circle-info text-amber-400 mt-0.5 shrink-0" aria-hidden="true"></i>
    <p class="text-[11px] text-amber-100/90 leading-snug"><strong class="text-amber-300">Triage Note:</strong> AD and Ryan-Joiner disagree on normality. Visually inspect the Normal Probability Plot for an S-curve or flat bottom before finalizing your Minitab method.</p>
  </div>`;
  el.classList.remove("hidden");
}

export function toggleCavityTriage() {
  const drawer = document.getElementById("spCavityTriage");
  const btn = document.getElementById("btn-triage-cavities");
  if (!drawer) return;
  cavityTriageOpen = !cavityTriageOpen;
  drawer.classList.toggle("hidden", !cavityTriageOpen);
  if (btn) {
    btn.setAttribute("aria-expanded", String(cavityTriageOpen));
    btn.classList.toggle("ring-2", cavityTriageOpen);
    btn.classList.toggle("ring-blue-500/50", cavityTriageOpen);
  }
  if (cavityTriageOpen) {
    syncTriageGroupButtons();
    syncTriageFullscreenButton();
    renderCavityTriageGrid();
    requestAnimationFrame(() => {
      drawer.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  } else {
    purgeCavityTriagePlots();
  }
}

function getSixPackFilteredData(dim) {
  const adj = adjustments[dim] || 0;
  return globalData
    .filter((d) => d.element === dim && !ignoredIds.has(d._id))
    .filter((d) => activeRunFilter.has(d.run || "No Run"))
    .map((d) => ({ ...d, valAdj: d.value + adj }));
}

/**
 * @returns {{ key: string, title: string, vals: number[], focusKind: string, focusArg: string }[]}
 */
function buildTriageGroups(data, mode) {
  const map = new Map();
  const add = (key, title, d) => {
    if (!map.has(key)) map.set(key, { key, title, vals: [], focusKind: mode, focusArg: key });
    map.get(key).vals.push(d.valAdj);
  };

  if (mode === TRIAGE_GROUP_MODES.CAVITY) {
    data.forEach((d) => {
      const key = getCavityKey(d);
      add(key, `Cav ${key}`, d);
      const g = map.get(key);
      g.focusKind = "cavity";
      g.focusArg = key;
    });
  } else if (mode === TRIAGE_GROUP_MODES.RUN) {
    data.forEach((d) => {
      const key = d.run || "No Run";
      add(key, key, d);
      const g = map.get(key);
      g.focusKind = "run";
      g.focusArg = key;
    });
  }

  return [...map.values()].sort((a, b) =>
    a.key.localeCompare(b.key, undefined, { numeric: true }),
  );
}

/**
 * Cavity × Run: nest runs under each physical cavity for banded layout.
 * @returns {{ cavityKey: string, cavityTitle: string, runs: object[] }[]}
 */
function buildTriageCavityBands(data) {
  const cavityMap = new Map();
  data.forEach((d) => {
    const cavKey = getCavityKey(d);
    const runKey = d.run || "No Run";
    const seriesLabel = getSeriesLabel(d);
    if (!cavityMap.has(cavKey)) {
      cavityMap.set(cavKey, {
        cavityKey: cavKey,
        cavityTitle: `Cav ${cavKey}`,
        runs: new Map(),
      });
    }
    const band = cavityMap.get(cavKey);
    if (!band.runs.has(runKey)) {
      band.runs.set(runKey, {
        runKey,
        runTitle: runKey,
        seriesLabel,
        title: runKey,
        vals: [],
        focusKind: "series",
        focusArg: seriesLabel,
      });
    }
    band.runs.get(runKey).vals.push(d.valAdj);
  });
  return [...cavityMap.values()]
    .sort((a, b) => a.cavityKey.localeCompare(b.cavityKey, undefined, { numeric: true }))
    .map((band) => ({
      ...band,
      runs: [...band.runs.values()].sort((a, b) =>
        a.runKey.localeCompare(b.runKey, undefined, { numeric: true }),
      ),
    }));
}

function flattenBandRuns(bands) {
  return bands.flatMap((b) => b.runs);
}

function minGroupsMessage(mode) {
  if (mode === TRIAGE_GROUP_MODES.RUN) {
    return "Need at least two runs in the current run filter to compare.";
  }
  if (mode === TRIAGE_GROUP_MODES.CAVITY_RUN) {
    return "Need at least two cavity × run series in the current filter to compare.";
  }
  return "Need at least two physical cavities in the current run filter to compare.";
}

/** Shared Y limits: axis min/max = global extrema ± 10% of total data range. */
function computeSharedYRange(groups) {
  const all = groups.flatMap((g) => g.vals).filter((v) => Number.isFinite(v));
  if (all.length === 0) return null;
  const globalMin = Math.min(...all);
  const globalMax = Math.max(...all);
  const totalRange = globalMax - globalMin;
  const pad = totalRange > 0 ? totalRange * 0.1 : Math.max(Math.abs(globalMax) * 0.01, 0.0001);
  let lo = globalMin - pad;
  let hi = globalMax + pad;
  if (lo === hi) {
    lo -= 0.0001;
    hi += 0.0001;
  }
  return [lo, hi];
}

/** Room for y tick labels (e.g. 19.5500) inside narrow mini cards. */
function computePlotLeftMargin(yRange) {
  if (!yRange) return 48;
  const fmt = (v) => {
    const span = yRange[1] - yRange[0];
    if (span < 0.0001) return v.toFixed(5);
    if (span < 0.01) return v.toFixed(4);
    if (span < 1) return v.toFixed(3);
    return v.toFixed(2);
  };
  const maxLen = Math.max(fmt(yRange[0]).length, fmt(yRange[1]).length);
  return Math.min(68, Math.max(46, Math.round(maxLen * 6.5 + 10)));
}

function tickFormatForRange(yRange) {
  if (!yRange) return ".4f";
  const span = yRange[1] - yRange[0];
  if (span < 0.0001) return ".5f";
  if (span < 0.01) return ".4f";
  if (span < 1) return ".3f";
  return ".2f";
}

function plotMiniBox(plotId, vals, label, yRange) {
  const el = document.getElementById(plotId);
  if (!el) return Promise.resolve();
  if (el.data) Plotly.purge(plotId);

  if (vals.length < 2) {
    el.innerHTML =
      '<div class="text-[10px] text-slate-500 flex items-center justify-center h-full">n &lt; 2</div>';
    return Promise.resolve();
  }

  const base = getBaseLayout();
  const layout = {
    margin: { t: 4, r: 8, l: computePlotLeftMargin(yRange), b: 20 },
    paper_bgcolor: base.paper_bgcolor,
    plot_bgcolor: base.plot_bgcolor,
    font: { size: 9, color: base.font.color },
    xaxis: { visible: false, fixedrange: true },
    yaxis: {
      ...base.yaxis,
      tickfont: { size: 8 },
      fixedrange: true,
      ticklabelstandoff: 2,
      ...(yRange ? { range: yRange, autorange: false } : {}),
      tickformat: tickFormatForRange(yRange),
    },
    showlegend: false,
    autosize: false,
    height: getMiniPlotHeight(),
  };

  const runPlot = () => {
    if (el.clientWidth < 1) {
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(runPlot())));
      });
    }
    layout.width = el.clientWidth;
    return Plotly.newPlot(
      plotId,
      [
        {
          y: vals,
          type: "box",
          name: label,
          boxpoints: "outliers",
          marker: { color: "#3b82f6", size: 3 },
          line: { color: "#60a5fa" },
          fillcolor: "rgba(59,130,246,0.15)",
        },
      ],
      layout,
      { displayModeBar: false, responsive: true, staticPlot: true },
    );
  };

  return runPlot();
}

function focusOnclick(group) {
  const arg = escapeAttr(group.focusArg);
  if (group.focusKind === "cavity") return `inspectCavityFromTriage('${arg}')`;
  if (group.focusKind === "run") return `inspectRunFromTriage('${arg}')`;
  return `inspectSeriesFromTriage('${arg}')`;
}

function renderMiniCardHtml(group, plotId, { bandCard = false } = {}) {
  const tooltip = (group.seriesLabel || group.title).replace(/"/g, "&quot;");
  const titleClass = bandCard ? "sp-cavity-run-title" : "truncate";
  const cardClass = bandCard ? "sp-cavity-mini-card sp-cavity-mini-card--run" : "sp-cavity-mini-card";
  return `<div class="${cardClass}">
        <div class="sp-cavity-mini-card-header">
          <span class="text-xs font-bold text-slate-200 ${titleClass}" title="${tooltip}">${group.title}</span>
          <span class="text-[10px] text-slate-500 shrink-0">n=${group.vals.length}</span>
          <button type="button" class="text-[10px] text-blue-400 hover:text-blue-300 shrink-0 ml-auto" onclick="${focusOnclick(group)}">Focus</button>
        </div>
        <div id="${plotId}" class="sp-cavity-mini-plot"></div>
      </div>`;
}

function renderFlatTriageGrid(grid, groups) {
  grid.className = "sp-cavity-triage-grid";
  grid.innerHTML = groups
    .map((group, index) => {
      const plotId = `${CAVITY_TRIAGE_PLOT_PREFIX}${index}`;
      return renderMiniCardHtml(group, plotId);
    })
    .join("");

  const yRange = computeSharedYRange(groups);
  Promise.all(
    groups.map((group, index) =>
      plotMiniBox(`${CAVITY_TRIAGE_PLOT_PREFIX}${index}`, group.vals, group.title, yRange),
    ),
  ).catch((err) => console.error("Cavity triage plots failed:", err));
}

function renderBandTriageGrid(grid, bands) {
  const leafGroups = flattenBandRuns(bands);
  grid.className = "sp-cavity-triage-bands-wrap";
  grid.innerHTML = bands
    .map((band, bandIndex) => {
      const runCount = band.runs.length;
      const cards = band.runs
        .map((run, runIndex) => {
          const plotId = `${CAVITY_TRIAGE_PLOT_PREFIX}${bandIndex}-${runIndex}`;
          return renderMiniCardHtml(run, plotId, { bandCard: true });
        })
        .join("");
      return `<section class="sp-triage-cavity-band" aria-label="${band.cavityTitle}">
        <div class="sp-triage-cavity-band-header">
          <span class="sp-triage-cavity-band-title">${band.cavityTitle}</span>
          <span class="text-[10px] text-slate-500">${runCount} run${runCount === 1 ? "" : "s"}</span>
        </div>
        <div class="sp-cavity-triage-grid sp-cavity-triage-grid--band">${cards}</div>
      </section>`;
    })
    .join("");

  const yRange = computeSharedYRange(leafGroups);
  const plotJobs = [];
  bands.forEach((band, bandIndex) => {
    band.runs.forEach((run, runIndex) => {
      const plotId = `${CAVITY_TRIAGE_PLOT_PREFIX}${bandIndex}-${runIndex}`;
      plotJobs.push(plotMiniBox(plotId, run.vals, run.runTitle, yRange));
    });
  });
  Promise.all(plotJobs).catch((err) => console.error("Cavity triage plots failed:", err));
}

export function renderCavityTriageGrid() {
  const grid = document.getElementById("spCavityTriageGrid");
  const dim = document.getElementById("spDimSelect")?.value;
  if (!grid || !dim) return;

  purgeCavityTriagePlots();
  syncTriageGroupButtons();

  const data = getSixPackFilteredData(dim);

  if (cavityTriageGroupMode === TRIAGE_GROUP_MODES.CAVITY_RUN) {
    const bands = buildTriageCavityBands(data);
    const leafGroups = flattenBandRuns(bands);
    if (leafGroups.length < 2) {
      grid.className = "sp-cavity-triage-bands-wrap";
      grid.innerHTML = `<p class="text-xs text-slate-500 py-4 text-center w-full">${minGroupsMessage(cavityTriageGroupMode)}</p>`;
      return;
    }
    renderBandTriageGrid(grid, bands);
    return;
  }

  const groups = buildTriageGroups(data, cavityTriageGroupMode);
  if (groups.length < 2) {
    grid.className = "sp-cavity-triage-grid";
    grid.innerHTML = `<p class="text-xs text-slate-500 py-4 text-center w-full">${minGroupsMessage(cavityTriageGroupMode)}</p>`;
    return;
  }
  renderFlatTriageGrid(grid, groups);
}

export function inspectCavityFromTriage(cavityKey) {
  const dim = document.getElementById("spDimSelect")?.value;
  const cavSelect = document.getElementById("spCavSelect");
  if (!dim || !cavSelect) return;
  const opt = findCavitySelectOption(cavityKey);
  if (!opt) return;
  cavSelect.value = opt.value;
  closeCavityTriageIfOpen();
  globalThis.updateSixPack?.();
}

export function inspectRunFromTriage(runKey) {
  const dim = document.getElementById("spDimSelect")?.value;
  const cavSelect = document.getElementById("spCavSelect");
  if (!dim || !cavSelect) return;
  activeRunFilter.clear();
  activeRunFilter.add(runKey);
  cavSelect.value = "all";
  closeCavityTriageIfOpen();
  globalThis.initRunFilter?.("sixpack", dim, true);
  globalThis.updateSixPack?.();
}

export function inspectSeriesFromTriage(seriesLabel) {
  const dim = document.getElementById("spDimSelect")?.value;
  const cavSelect = document.getElementById("spCavSelect");
  if (!dim || !cavSelect) return;
  const opt = Array.from(cavSelect.options).find((o) => o.value === seriesLabel);
  if (!opt) return;
  cavSelect.value = seriesLabel;
  closeCavityTriageIfOpen();
  globalThis.updateSixPack?.();
}

export function closeCavityTriageIfOpen() {
  if (!cavityTriageOpen) return;
  cavityTriageOpen = false;
  if (isCavityTriageFullscreenActive()) setCavityTriageFullscreen(false);
  purgeCavityTriagePlots();
  document.getElementById("spCavityTriage")?.classList.add("hidden");
  const btn = document.getElementById("btn-triage-cavities");
  if (btn) {
    btn.setAttribute("aria-expanded", "false");
    btn.classList.remove("ring-2", "ring-blue-500/50");
  }
}
