/* global Plotly */

import { currentTab } from "../state.js";
import { closeAiHelper } from "./ai-sidebar.js";
import { scheduleSixPackResize } from "../charts/plotly-sixpack-utils.js";
export function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById(
    tab === "standard" ? "tabStandard" : tab === "sixpack" ? "tabSixPack" : tab === "spc" ? "tabSPC" : "tabSummary"
  );
  if (btn) btn.classList.add("active");

  document.getElementById("viewStandard").classList.add("hidden");
  document.getElementById("viewSixPack").classList.add("hidden");
  document.getElementById("viewSPC").classList.add("hidden");
  document.getElementById("viewSummary").classList.add("hidden");

  closeAiHelper();

  if (tab === "standard") {
    document.getElementById("viewStandard").classList.remove("hidden");
    globalThis.handleTypeFilterChange?.();
    globalThis.syncSteelAdjInputs?.();
  } else if (tab === "sixpack") {
    document.getElementById("viewSixPack").classList.remove("hidden");
    const dim = document.getElementById("spDimSelect").value;
    if (dim) globalThis.initRunFilter?.("sixpack", dim, true);
    globalThis.syncSteelAdjInputs?.();
    requestAnimationFrame(() => {
      globalThis.updateSixPack?.();
      setTimeout(scheduleSixPackResize, 50);
    });
  } else if (tab === "spc") {
    document.getElementById("viewSPC").classList.remove("hidden");
    globalThis.updateSPC?.();
  } else {
    document.getElementById("viewSummary").classList.remove("hidden");
    globalThis.updateSummary?.();
  }
}
