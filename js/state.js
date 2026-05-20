export let globalData = [];
export let adjustments = {};
export let ignoredIds = new Set();
export let dimensionImages = {};
export let activeSeriesFilter = new Set();
export let activeRunFilter = new Set();
export let currentTab = "standard";

export let pdfDoc = null;
export let pdfPageNum = 1;
export let pdfScale = 1.5;
export let wizardDims = [];
export let currentWizardIndex = 0;

export let currentFileHandle = null;
export let projectFileName = "";
export let rawWorkbookBuffer = null;
export let isLightMode = true;

export let currentAiState = {};
export let currentOutliers = [];
export let targetCaptureDim = null;

/** Active normality test for Six-Pack (Minitab-style). */
export let normalityTestId = "anderson_darling";

export function setNormalityTestId(id) {
  normalityTestId = id;
}

/** Six-Pack overall capability method when data is non-normal (AD p < 0.05). */
export let capabilityMethod = "parametric";
export let capabilityMethodMeta = {};
export let capabilityOptions = [];

export function setCapabilityMethodState(id) {
  capabilityMethod = id;
}

export function setCapabilityMethodMeta(meta) {
  capabilityMethodMeta = meta;
}

export function setCapabilityOptions(options) {
  capabilityOptions = options;
}
