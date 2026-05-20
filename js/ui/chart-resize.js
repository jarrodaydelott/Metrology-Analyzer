/* global Plotly */

import { currentTab } from "../state.js";
import { scheduleSixPackResize } from "../charts/plotly-sixpack-utils.js";

let debounceTimer = null;

function debouncedResize() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (currentTab === "sixpack" && !document.getElementById("viewSixPack")?.classList.contains("hidden")) {
      scheduleSixPackResize();
    }
    const chartEl = document.getElementById("chart");
    if (
      currentTab === "standard" &&
      !document.getElementById("viewStandard")?.classList.contains("hidden") &&
      chartEl?.layout
    ) {
      Plotly.Plots.resize("chart");
    }
  }, 100);
}

export function initChartResizeObservers() {
  const sixPackGrid = document.querySelector("#viewSixPack .flex-grow.grid");
  const chartParent = document.getElementById("chart")?.parentElement;

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(debouncedResize);
    if (sixPackGrid) observer.observe(sixPackGrid);
    if (chartParent) observer.observe(chartParent);
  }

  window.addEventListener("resize", debouncedResize);
}
