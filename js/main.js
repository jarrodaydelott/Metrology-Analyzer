/**
 * Entry: loads the full app (side effects: DOM listeners, window onclick handlers).
 * Stubs apply only when loading js/main.js as an external ES module (npm run dev).
 * The single-file bundle inlines application first and must not clobber window exports.
 */
const ONCLICK_STUBS = [
  "showMainApp",
  "showStartPage",
  "openChangelogModal",
  "closeChangelogModal",
  "generateTemplate",
  "handleFileSelect",
  "skipPdfImport",
  "startPdfWizard",
];

const isExternalModuleEntry =
  typeof document !== "undefined" &&
  document.querySelector('script[type="module"][src*="main.js"]');

if (isExternalModuleEntry) {
  for (const name of ONCLICK_STUBS) {
    globalThis[name] = function onclickStub() {
      console.warn(`${name}: application module is still loading or failed to load.`);
    };
  }
}

import "./application.mjs";
import { initChartResizeObservers } from "./ui/chart-resize.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChartResizeObservers);
} else {
  initChartResizeObservers();
}
