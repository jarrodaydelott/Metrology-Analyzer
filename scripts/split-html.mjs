import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "Metrology Data Analyzer Ver 1.5.html");
const lines = fs.readFileSync(htmlPath, "utf8").split(/\r?\n/);

const slice = (a, b) => lines.slice(a - 1, b).join("\n");

/** Lines L where L is 1-based, in [735,3462] ∪ [3530,3640] */
function inMainScript(L) {
  if (L >= 735 && L <= 3462) return true;
  if (L >= 3530 && L <= 3640) return true;
  return false;
}

/** Exclusive ranges to drop (1-based, inclusive) */
const DROP = [
  [735, 780],
  [781, 1028],
  [1405, 1641],
  [1643, 1713],
  [2496, 2522],
  [2524, 2665],
  [2667, 2820],
  [2824, 2893],
  [3036, 3375],
  [3382, 3461],
];

function dropped(L) {
  return DROP.some(([a, b]) => L >= a && L <= b);
}

function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.trimEnd() + "\n", "utf8");
}

// --- CSS
write("css/app.css", slice(42, 220));

// --- index.html
const headPart1 = lines.slice(0, 9).join("\n");
const tailwindConfig = lines.slice(10, 28).join("\n");
const vendors = lines.slice(30, 39).join("\n");
const body = lines.slice(222, 732).join("\n");
const indexHtml = `${headPart1}
${tailwindConfig}
${vendors}
    <link rel="stylesheet" href="css/app.css">
</head>
${body}
    <script type="module" src="js/main.js"></script>
</body>
</html>
`;
write("index.html", indexHtml);

// --- Extracted modules from original line ranges (1-based)
write(
  "js/state.js",
  `${slice(738, 749)}
${slice(752, 759)}
export let currentAiState = {};
export let currentOutliers = [];
export let currentInsights = {};
export let targetCaptureDim = null;
`
);

write(
  "js/constants.js",
  `${slice(750, 752)}
${slice(761, 779)}
export const LENS_W = 300;
export const LENS_H = 250;
${slice(3103, 3112)}
`
);

write(
  "js/math/stats.js",
  `${slice(2674, 2679)}
`
);

write("js/charts/plotly-layout.js", `${slice(2524, 2546)}\n`);

write("js/charts/plotly-sixpack.js", `${slice(2548, 2665)}\n`);

write(
  "js/charts/plotly-dashboard.js",
  `${slice(1405, 1595)}
${slice(1597, 1634)}
${slice(1636, 1641)}
${slice(2496, 2522)}
${slice(3530, 3588)}
`
);

write(
  "js/analysis/expert.js",
  `window.currentInsights = {};
${slice(2681, 2820)}
`
);

write(
  "js/data/excel.js",
  `${slice(781, 1028)}
${slice(3382, 3461)}
`
);

write(
  "js/data/project.js",
  slice(2824, 2893)
    .replace(/\bconst state = \{/g, "const payload = {")
    .replace(/\bJSON\.stringify\(state,/g, "JSON.stringify(payload,")
    .replace(/\bstate\.data\b/g, "payload.data")
    .replace(/\bstate\.adjustments\b/g, "payload.adjustments")
    .replace(/\bstate\.ignoredIds\b/g, "payload.ignoredIds")
    .replace(/\bstate\.unit\b/g, "payload.unit")
    .replace(/\bstate\.targetCpk\b/g, "payload.targetCpk")
    .replace(/\bstate\.dimensionImages\b/g, "payload.dimensionImages")
    .replace(/\bstate\.timestamp\b/g, "payload.timestamp")
);

write(
  "js/export/pptx.js",
  `${slice(3072, 3375)}
`
);

write(
  "js/ui/drawing-popup.js",
  `${slice(1643, 1690)}
`
);

write(
  "js/ui/ai-sidebar.js",
  `${slice(1692, 1713)}
`
);

write(
  "js/ui/chart-controls.js",
  `${slice(3039, 3070)}
`
);

// --- application.mjs body (filtered lines)
const appLines = [];
for (let L = 735; L <= 3640; L++) {
  if (!inMainScript(L)) continue;
  if (dropped(L)) continue;
  appLines.push(lines[L - 1]);
}

const preamble = `import {
  globalData,
  adjustments,
  ignoredIds,
  dimensionImages,
  activeSeriesFilter,
  activeRunFilter,
  currentTab,
  pdfDoc,
  pdfPageNum,
  pdfScale,
  wizardDims,
  currentWizardIndex,
  currentFileHandle,
  projectFileName,
  rawWorkbookBuffer,
  isLightMode,
  currentAiState,
  currentOutliers,
  currentInsights,
  targetCaptureDim,
} from "./state.js";
import {
  D2_CONSTANTS,
  chartExplanations,
  AI_INTRO_TEMPLATE,
  SPC_AI_TEMPLATE,
  PDF_MIN_SCALE,
  PDF_MAX_SCALE,
} from "./constants.js";
import {
  calculateSkewness,
  getNormalitySuggestion,
  calculateTrend,
  getQuantile,
  calculateAndersonDarling,
  checkRangeControl,
} from "./math/stats.js";
import { getBaseLayout } from "./charts/plotly-layout.js";
import {
  renderControlCharts,
  renderRunChart,
  renderHistogram,
  renderProbPlot,
  renderStatsPanel,
} from "./charts/plotly-sixpack.js";
import {
  updateDashboard,
  renderCustomLegend,
  renderTable,
  toggleLightMode,
  applyThemeToCharts,
} from "./charts/plotly-dashboard.js";
import { addBulb, runExpertAnalysis } from "./analysis/expert.js";
import {
  compressForExcel,
  generateTemplate,
  handleFile,
  processData,
  injectDrawingsToExcel,
  finishWizard,
} from "./data/excel.js";
import { saveProject, handleLoadProject } from "./data/project.js";
import {
  prepareSnippetForPPTX,
  exportStandardAnalysisSlideDeck,
  renderStandardChartToImage,
  showExportOverlay,
  updateExportStatusText,
  hideExportOverlay,
} from "./export/pptx.js";
import {
  updateDrawingPopupImage,
  updateDrawingButtonVisibility,
} from "./ui/drawing-popup.js";
import { openAiHelper, closeAiHelper } from "./ui/ai-sidebar.js";
import { showChartHelp, toggleChartFullscreen } from "./ui/chart-controls.js";
`;

write("js/application.mjs", preamble + appLines.join("\n") + "\n");

console.log("split-html.mjs: wrote index.html, css/app.css, js/* modules, js/application.mjs");
