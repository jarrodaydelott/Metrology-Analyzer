import {
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
  targetCaptureDim,
} from "./state.js";
import {
  D2_CONSTANTS,
  chartExplanations,
  AI_INTRO_TEMPLATE,
  SPC_AI_TEMPLATE,
  LENS_W,
  LENS_H,
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
  initThemeFromStorage,
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
import { switchTab } from "./ui/tabs.js";
import { getSeriesLabel, getFullDimensionName } from "./utils/labels.js";
import { deferred } from "./app-delegates.js";
import {
  triggerAfterExcelUpload,
  skipPdfImport,
  openPdfWizardFromHeader,
  startPdfWizard,
  renderWizardList,
  wizardSkipStep,
  closePdfWizard,
  startRetake,
  setupReticle,
  executeSurgicalCapture,
  stopCameraLens,
  handleFileSelect,
  renderPdfPage,
  zoomPdf,
  changePdfPage,
  refreshPdfDimList,
} from "./pdf/wizard.js";

// ==========================================
// 4. NAVIGATION & INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initThemeFromStorage();
    document.getElementById('fileUpload').addEventListener('change', handleFile, false);
    document.getElementById('projectUpload').addEventListener('change', handleLoadProject, false);
    document.getElementById('dimSelect').addEventListener('change', handleDimensionChange, false);
    document.getElementById('steelAdjStd').addEventListener('input', handleAdjustmentChange, false);
    document.getElementById('steelAdjSp').addEventListener('input', handleAdjustmentChange, false);
    document.getElementById('unitSelect').addEventListener('change', handleUnitChange, false);
    document.getElementById('targetCpkInput').addEventListener('change', handleTargetCpkChange, false);
    document.getElementById('spDimSelect').addEventListener('change', resetAndUpdateSixPack, false);
    document.getElementById('spCavSelect').addEventListener('change', resetAndUpdateSixPack, false);
});

function showMainApp() {
    document.getElementById('startPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
}

function initUI() {
    const currentUnit = document.getElementById('unitSelect').value;
    const unitLabelStd = document.getElementById('unitLabelStd');
    const unitLabelSp = document.getElementById('unitLabelSp');
    
    if (unitLabelStd) unitLabelStd.textContent = currentUnit;
    if (unitLabelSp) unitLabelSp.textContent = currentUnit;

    const typeSelect = document.getElementById('typeFilter');
    const uniqueTypes = [...new Set(globalData.map(d => d.description || "Basic"))].sort();
    
    if(typeSelect) {
        typeSelect.innerHTML = '<option value="ALL">All Types</option>';
        uniqueTypes.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t; opt.text = t;
            typeSelect.appendChild(opt);
        });
    }

    // Populate the dimensions dropdown
    if (typeof handleTypeFilterChange === 'function') handleTypeFilterChange(); 

    // Safely initialize global run filters for the SPC and Summary Tabs
    if (typeof initRunFilter === 'function') {
        initRunFilter('spc', null); 
        initRunFilter('sum', null);
    }

    if (typeof initSixPackUI === 'function') initSixPackUI();

    // Safely toggle visibility of main containers
    const emptyState = document.getElementById('emptyState');
    const tabContainer = document.getElementById('tabContainer');
    const pdfBtn = document.getElementById('btn-return-pdf');

    if (emptyState) emptyState.classList.add('hidden');
    if (tabContainer) tabContainer.classList.remove('hidden');
    if (pdfBtn) pdfBtn.classList.remove('hidden');
    
    if (typeof switchTab === 'function') switchTab('standard');
}

function initSixPackUI() {
            const spSelect = document.getElementById('spDimSelect');
            if(!spSelect) return;
            spSelect.innerHTML = "";
            
            const uniqueDims = [...new Set(globalData.map(d => d.element))];
            const criticalDims = uniqueDims.filter(dim => {
                const rec = globalData.find(d => d.element === dim);
                return rec && rec.description === 'Critical';
            });

            if (criticalDims.length > 0) {
                criticalDims.forEach(dim => { 
                    const rec = globalData.find(d => d.element === dim);
                    const opt = document.createElement("option"); 
                    // CRITICAL FIX: The value must be the raw ID (dim), not the full name
                    opt.value = dim; 
                    opt.text = getFullDimensionName(rec); 
                    spSelect.appendChild(opt); 
                });
                
                initRunFilter('sixpack', criticalDims[0]); 
                refreshSixPackCavities();
            } else {
                const opt = document.createElement("option"); 
                opt.text = "No Critical Items Found"; 
                spSelect.appendChild(opt);
            }
        }

// ==========================================
// 5. FILTER LOGIC
// ==========================================
function toggleRunDropdown(view) {
    let id = '';
    if (view === 'std') id = 'runFilterContent';
    else if (view === 'sixpack') id = 'spRunFilterContent';
    else if (view === 'spc') id = 'spcRiskRunFilterContent';
    else if (view === 'sum') id = 'sumRunFilterContent';
    else id = 'runFilterContent'; 
    document.getElementById(id).classList.toggle('hidden');
}

document.addEventListener('click', function(event) {
    const closes = [
        {btn: 'runFilterBtn', content: 'runFilterContent'},
        {btn: 'spRunFilterBtn', content: 'spRunFilterContent'},
        {btn: 'spcRiskRunFilterBtn', content: 'spcRiskRunFilterContent'},
        {btn: 'sumRunFilterBtn', content: 'sumRunFilterContent'}
    ];
    closes.forEach(pair => {
        const btn = document.getElementById(pair.btn);
        const cont = document.getElementById(pair.content);
        if(btn && cont && !btn.contains(event.target) && !cont.contains(event.target)) {
            cont.classList.add('hidden');
        }
    });
});

function handleRunFilterChange(view, run, isChecked, allRunList) {
    let containerId = '';
    let allChkId = `chk-run-all-${view}`;

    if (view === 'std') containerId = '#runFilterContent';
    else if (view === 'sixpack' || view === 'sp') containerId = '#spRunFilterContent';
    else if (view === 'spc') containerId = '#spcRiskRunFilterContent';
    else if (view === 'sum') containerId = '#sumRunFilterContent';

    if (run === 'ALL') {
        const checkboxes = document.querySelectorAll(`${containerId} input[type="checkbox"]`);
        checkboxes.forEach(cb => cb.checked = isChecked);
        if (isChecked && allRunList) { allRunList.forEach(r => activeRunFilter.add(r)); } 
        else { activeRunFilter.clear(); }
    } else {
        if (isChecked) activeRunFilter.add(run); else activeRunFilter.delete(run);
        const allCb = document.getElementById(allChkId);
        if(allCb) {
            const checkboxes = document.querySelectorAll(`${containerId} input[type="checkbox"]:not(#${allChkId})`);
            const allChecked = Array.from(checkboxes).every(c => c.checked);
            allCb.checked = allChecked;
        }
    }
    updateRunFilterLabel(view);
    
    if(view === 'std') { updateDashboard(); } 
    else if (view === 'sixpack' || view === 'sp') { refreshSixPackCavities(); updateSixPack(); } 
    else if (view === 'spc') { updateSPC(); } 
    else if (view === 'sum') { updateSummary(); }
}

function updateRunFilterLabel(view) {
    const count = activeRunFilter.size;
    let labelId = '', containerId = '', allChkId = `chk-run-all-${view}`;
    if (view === 'std') { labelId = 'runFilterLabel'; containerId = '#runFilterContent'; }
    else if (view === 'sixpack' || view === 'sp') { labelId = 'spRunFilterLabel'; containerId = '#spRunFilterContent'; }
    else if (view === 'spc') { labelId = 'spcRiskRunFilterLabel'; containerId = '#spcRiskRunFilterContent'; }
    else if (view === 'sum') { labelId = 'sumRunFilterLabel'; containerId = '#sumRunFilterContent'; }

    const label = document.getElementById(labelId);
    if(!label) return;
    const totalOptions = document.querySelectorAll(`${containerId} input[type="checkbox"]:not(#${allChkId})`).length;
    if (count === 0) label.textContent = "None Selected";
    else if (count === totalOptions) label.textContent = "All Selected";
    else label.textContent = `${count} Selected`;
}

function initRunFilter(view, dim, preserveState = false) {
    const dimData = globalData.length > 0 ? globalData : [];
    const runList = [...new Set(dimData.map(d => d.run || "No Run"))].sort();
    
    if (preserveState) {
        const validActive = new Set();
        activeRunFilter.forEach(r => { if (runList.includes(r)) validActive.add(r); });
        activeRunFilter.clear();
        (validActive.size > 0 ? validActive : new Set(runList)).forEach(r => activeRunFilter.add(r));
    } else {
        activeRunFilter.clear();
        runList.forEach(r => activeRunFilter.add(r));
    }

    let containerId = '';
    if (view === 'std') containerId = 'runFilterContent';
    else if (view === 'sixpack' || view === 'sp') containerId = 'spRunFilterContent';
    else if (view === 'spc') containerId = 'spcRiskRunFilterContent';
    else if (view === 'sum') containerId = 'sumRunFilterContent';

    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';

    const allDiv = document.createElement('div');
    allDiv.className = 'flex items-center p-2 hover:bg-slate-700 rounded cursor-pointer';
    const isAllActive = runList.every(r => activeRunFilter.has(r));
    allDiv.innerHTML = `<input type="checkbox" id="chk-run-all-${view}" ${isAllActive ? 'checked' : ''} class="w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-600 ring-offset-slate-800"><label for="chk-run-all-${view}" class="ml-2 text-sm text-slate-200 cursor-pointer w-full font-bold">Select All</label>`;
    allDiv.onclick = (e) => { if(e.target.tagName !== 'INPUT') { const cb = allDiv.querySelector('input'); cb.checked = !cb.checked; handleRunFilterChange(view, 'ALL', cb.checked, runList); } };
    allDiv.querySelector('input').onchange = (e) => handleRunFilterChange(view, 'ALL', e.target.checked, runList);
    container.appendChild(allDiv);

    runList.forEach(r => {
        const isChecked = activeRunFilter.has(r);
        const div = document.createElement('div');
        div.className = 'flex items-center p-2 hover:bg-slate-700 rounded cursor-pointer';
        div.innerHTML = `<input type="checkbox" id="chk-run-${view}-${r}" ${isChecked ? 'checked' : ''} class="w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-600 ring-offset-slate-800"><label for="chk-run-${view}-${r}" class="ml-2 text-sm text-slate-200 cursor-pointer w-full">${r}</label>`;
        div.onclick = (e) => { if(e.target.tagName !== 'INPUT') { const cb = div.querySelector('input'); cb.checked = !cb.checked; handleRunFilterChange(view, r, cb.checked); } };
        div.querySelector('input').onchange = (e) => handleRunFilterChange(view, r, e.target.checked);
        container.appendChild(div);
    });
    updateRunFilterLabel(view);
}

function initSeriesFilter(dim, preserveState = false) {
            let dimData = globalData.filter(d => d.element === dim);
            dimData = dimData.filter(d => activeRunFilter.has(d.run || "No Run"));
            const seriesList = [...new Set(dimData.map(d => getSeriesLabel(d)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
            
            if (preserveState) {
                const validActive = new Set();
                activeSeriesFilter.forEach(s => { if (seriesList.includes(s)) validActive.add(s); });
                activeSeriesFilter.clear();
                (validActive.size > 0 ? validActive : new Set(seriesList)).forEach(s => activeSeriesFilter.add(s));
            } else {
                activeSeriesFilter.clear();
                seriesList.forEach(s => activeSeriesFilter.add(s));
            }
            
            const container = document.getElementById('seriesFilterContent');
            if(!container) return;
            container.innerHTML = '';
            
            const allDiv = document.createElement('div');
            allDiv.className = 'flex items-center p-2 hover:bg-slate-700 rounded cursor-pointer';
            const isAllChecked = seriesList.length > 0 && seriesList.every(s => activeSeriesFilter.has(s));
            allDiv.innerHTML = `<input type="checkbox" id="chk-all" ${isAllChecked ? 'checked' : ''} class="w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-600 ring-offset-slate-800"><label for="chk-all" class="ml-2 text-sm text-slate-200 cursor-pointer w-full font-bold">Select All</label>`;
            allDiv.onclick = (e) => { if(e.target.tagName !== 'INPUT') { const cb = allDiv.querySelector('input'); cb.checked = !cb.checked; handleSeriesFilterChange('ALL', cb.checked, seriesList); } };
            allDiv.querySelector('input').onchange = (e) => handleSeriesFilterChange('ALL', e.target.checked, seriesList);
            container.appendChild(allDiv);

            seriesList.forEach(s => {
                const div = document.createElement('div');
                div.className = 'flex items-center p-2 hover:bg-slate-700 rounded cursor-pointer';
                const isChecked = activeSeriesFilter.has(s);
                div.innerHTML = `<input type="checkbox" id="chk-${s}" ${isChecked ? 'checked' : ''} class="w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-600 ring-offset-slate-800"><label for="chk-${s}" class="ml-2 text-sm text-slate-200 cursor-pointer w-full">${s}</label>`;
                div.querySelector('input').dataset.series = s;
                div.onclick = (e) => { if(e.target.tagName !== 'INPUT') { const cb = div.querySelector('input'); cb.checked = !cb.checked; handleSeriesFilterChange(s, cb.checked); } };
                div.querySelector('input').onchange = (e) => handleSeriesFilterChange(s, e.target.checked);
                container.appendChild(div);
            });
            updateFilterLabel();
        }

        function updateFilterLabel() {
            const count = activeSeriesFilter.size;
            const label = document.getElementById('seriesFilterLabel');
            if(!label) return;
            const totalOptions = document.querySelectorAll('#seriesFilterContent input[type="checkbox"]:not(#chk-all)').length;
            if (count === 0) label.textContent = "None Selected";
            else if (count === totalOptions) label.textContent = "All Selected";
            else label.textContent = `${count} Selected`;
        }

function handleSeriesFilterChange(series, isChecked, allSeriesList) {
    if (series === 'ALL') {
        const seriesNames = allSeriesList || Array.from(document.querySelectorAll('#seriesFilterContent input[type="checkbox"]:not(#chk-all)')).map(cb => cb.dataset.series || cb.nextElementSibling?.textContent).filter(Boolean);
        activeSeriesFilter.clear();
        if (isChecked) seriesNames.forEach(s => activeSeriesFilter.add(s));
        document.querySelectorAll('#seriesFilterContent input[type="checkbox"]:not(#chk-all)').forEach(cb => {
            cb.checked = isChecked;
        });
    } else {
        if (isChecked) activeSeriesFilter.add(series); else activeSeriesFilter.delete(series);
        const allCb = document.getElementById('chk-all');
        if (allCb) {
            const checkboxes = document.querySelectorAll('#seriesFilterContent input[type="checkbox"]:not(#chk-all)');
            allCb.checked = checkboxes.length > 0 && Array.from(checkboxes).every(c => c.checked);
        }
    }
    updateFilterLabel();
    updateDashboard();
}

function handleTypeFilterChange() {
    const typeFilter = document.getElementById('typeFilter').value;
    const dimSelect = document.getElementById('dimSelect');
    const currentSelection = dimSelect.value;
    dimSelect.innerHTML = "";

    let filteredDims = globalData;
    if (typeFilter !== "ALL") {
        filteredDims = globalData.filter(d => d.description === typeFilter);
    }
    const uniqueDims = [...new Set(filteredDims.map(d => d.element))];

    if (uniqueDims.length === 0) {
        const opt = document.createElement("option");
        opt.text = "No Dimensions Found";
        dimSelect.appendChild(opt);
    } else {
        uniqueDims.forEach(dim => {
            const rec = globalData.find(d => d.element === dim);
            const opt = document.createElement("option");
            opt.value = dim;
            opt.text = getFullDimensionName(rec); 
            dimSelect.appendChild(opt);
        });
        if (uniqueDims.includes(currentSelection)) {
            dimSelect.value = currentSelection;
        }
    }
    handleDimensionChange();
}

function handleDimensionChange() {
    const dim = document.getElementById('dimSelect').value;
    
    // RE-ADDED: Build the dropdown lists based on the newly selected dimension
    initRunFilter('std', dim, true);
    initSeriesFilter(dim, true);
    const steelAdjStd = document.getElementById('steelAdjStd');
    if (steelAdjStd) steelAdjStd.value = ((dim && adjustments[dim]) || 0).toFixed(4);
    
    updateDrawingPopupImage('std');  // Ensure standard popup image is updated if it was open
    updateDashboard();               // Redraws charts AND the legend
    updateDrawingButtonVisibility(); // Hook to update the visibility of the filter-row button
}

function handleAdjustmentChange(e) { 
    const val = parseFloat(e.target.value) || 0; 
    let dim = (currentTab === 'standard') ? document.getElementById('dimSelect').value : document.getElementById('spDimSelect').value; 
    if(dim) { 
        adjustments[dim] = val; 
        if (currentTab === 'standard') updateDashboard(); 
        else if (currentTab === 'sixpack') updateSixPack(); 
    } 
}

function handleTargetCpkChange(e) { 
    if (currentTab === 'standard') updateDashboard(); 
    else if (currentTab === 'sixpack') { if(typeof updateSixPack === 'function') updateSixPack(); }
    else if (typeof updateSummary === 'function') updateSummary(); 
}

function handleUnitChange(e) { 
    const unitLabelStd = document.getElementById('unitLabelStd');
    const unitLabelSp = document.getElementById('unitLabelSp');
    if (unitLabelStd) unitLabelStd.textContent = e.target.value; 
    if (unitLabelSp) unitLabelSp.textContent = e.target.value; 
    handleTargetCpkChange(e); 
}

// ==========================================
// --- RESTORED MISSING FUNCTIONS ---
// ==========================================

function updateSixPack() {
    const dim = document.getElementById('spDimSelect').value;
    const cavMode = document.getElementById('spCavSelect').value;
    const targetCpk = parseFloat(document.getElementById('targetCpkInput').value) || 1.33;
    const warningDiv = document.getElementById('spWarning');
    const warningText = document.getElementById('spWarningText');
    const aiBtn = document.getElementById('btn-ai-help');
    const remBtn = document.getElementById('btn-remove-outliers');
    const resetBtn = document.getElementById('btn-reset-outliers');
    
    window.currentInsights = {};
    document.querySelectorAll('.pulsing-bulb').forEach(el => el.classList.add('hidden'));
    warningDiv.classList.add('hidden');
    if(aiBtn) aiBtn.classList.remove('hidden'); 
    remBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
    
    if (ignoredIds.size > 0) { 
        resetBtn.textContent = `Reset Data (${ignoredIds.size} excluded)`; 
        resetBtn.classList.remove('hidden'); 
        warningDiv.classList.remove('hidden'); 
    }

    currentAiState = { isMixedCavity: (cavMode === 'all'), isLowRes: false, isBoundary: false, hasTrend: false };
    currentOutliers = [];
	updateDrawingPopupImage('sp');
    if (!dim || dim.includes("No Critical")) return;

    let data = globalData.filter(d => d.element === dim && !ignoredIds.has(d._id));
    const adj = adjustments[dim] || 0;
    document.getElementById('steelAdjSp').value = adj.toFixed(4);
    
    data = data.filter(d => activeRunFilter.has(d.run || "No Run"));
    if (cavMode !== 'all') { data = data.filter(d => getSeriesLabel(d) === cavMode); }

    if (data.length === 0) {
        ['spChart1', 'spChart2', 'spChart3', 'spChart4', 'spChart5', 'spChart6'].forEach(id => { 
            if(document.getElementById(id)) {
                Plotly.purge(id); 
                document.getElementById(id).innerHTML = '<div class="flex items-center justify-center h-full text-slate-500">No Data Selected</div>'; 
            }
        });
        document.getElementById('spStats').innerHTML = '<div class="text-slate-500 text-sm">No Data Selected</div>';
        return;
    }

    data.forEach(d => { d.valAdj = d.value + adj; });
    data.sort((a,b) => a.sample - b.sample || a.cavity - b.cavity);
    
    const { usl, lsl, nominal } = data[0];
    let subgroups = []; 
    let subSize = 1;
    
    if (cavMode === 'all') {
        const samples = [...new Set(data.map(d => d.sample))].sort((a,b)=>a-b);
        samples.forEach(s => {
            const groupData = data.filter(d => d.sample === s);
            if(groupData.length === 0) return;
            const vals = groupData.map(d => d.valAdj);
            const ids = groupData.map(d => d._id);
            subgroups.push({ id: s, values: vals, ids: ids, mean: jStat.mean(vals), range: jStat.range(vals) });
        });
        if(subgroups.length > 0) subSize = Math.round(subgroups.reduce((acc, g) => acc + g.values.length, 0) / subgroups.length);
    } else {
        data.forEach(d => { 
            subgroups.push({ id: d.sample, values: [d.valAdj], ids: [d._id], mean: d.valAdj, range: 0 }); 
        });
        subSize = 1;
    }

    const allValues = data.map(d => d.valAdj);
    const overallMean = jStat.mean(allValues);
    const overallStDev = jStat.stdev(allValues, true); 
    let withinStDev = 0; 
    let chartType = ""; 

    if (subSize > 1) {
        chartType = 'XbarR';
        const d2 = D2_CONSTANTS[Math.min(subSize, 16)] || Math.sqrt(subSize); 
        const rBar = jStat.mean(subgroups.map(g => g.range));
        withinStDev = rBar / d2;
    } else {
        chartType = 'IMR';
        let mrSum = 0; let mrCount = 0;
        for(let i=1; i<subgroups.length; i++) { 
            const mr = Math.abs(subgroups[i].mean - subgroups[i-1].mean); 
            mrSum += mr; mrCount++; 
            subgroups[i].mr = mr; 
        }
        subgroups[0].mr = 0;
        const mrBar = mrCount > 0 ? mrSum / mrCount : 0;
        const d2 = 1.128; 
        withinStDev = mrBar / d2;
    }

    const Cp = (usl - lsl) / (6 * withinStDev);
    const CpkU = (usl - overallMean) / (3 * withinStDev);
    const CpkL = (overallMean - lsl) / (3 * withinStDev);
    const Cpk = Math.min(CpkU, CpkL);
    const Pp_Norm = (usl - lsl) / (6 * overallStDev);
    const PpkU_Norm = (usl - overallMean) / (3 * overallStDev);
    const PpkL_Norm = (overallMean - lsl) / (3 * overallStDev);
    const Ppk_Norm = Math.min(PpkU_Norm, PpkL_Norm);
    let Pp = Pp_Norm; 
    let Ppk = Ppk_Norm;

    const adStats = calculateAndersonDarling(allValues);
    let isNormal = adStats.p >= 0.05;
    let ppkIsPercentile = false;
    const trend = calculateTrend(allValues);
    if (Math.abs(trend) > 0.5) currentAiState.hasTrend = true;

    if (!isNormal) {
        const uniqueVals = new Set(allValues).size;
        const tolerance = usl - lsl;
        const sortedVals = [...allValues].sort((a,b)=>a-b);
        let minStep = Infinity;
        for(let i=1; i<sortedVals.length; i++){ 
            const diff = sortedVals[i] - sortedVals[i-1]; 
            if(diff > 0.0000001 && diff < minStep) minStep = diff; 
        }
        const stepsInTol = tolerance / minStep;
        if (uniqueVals < 5 || stepsInTol < 10) { currentAiState.isLowRes = true; }
        const minVal = Math.min(...allValues);
        if (minVal >= 0 && minVal < (tolerance * 0.1) && jStat.mean(allValues) < (tolerance * 0.25)) { 
            currentAiState.isBoundary = true; 
        }
        
        const q1 = getQuantile(allValues, 0.25); const q3 = getQuantile(allValues, 0.75);
        const iqr = q3 - q1; const lowThreshold = q1 - 1.5 * iqr; const highThreshold = q3 + 1.5 * iqr;
        data.forEach(d => { if (d.valAdj < lowThreshold || d.valAdj > highThreshold) { currentOutliers.push(d._id); } });
        
        const median = jStat.median(allValues);
        const p99865 = getQuantile(allValues, 0.99865); const p00135 = getQuantile(allValues, 0.00135);
        if (p99865 > p00135) { 
            Pp = (usl - lsl) / (p99865 - p00135); 
            const PpkU = (usl - median) / (p99865 - median); 
            const PpkL = (median - lsl) / (median - p00135); 
            Ppk = Math.min(PpkU, PpkL); 
            ppkIsPercentile = true; 
        }
    }

    const statsContext = { chartType, overallMean, overallStDev, withinStDev, Cp, Cpk, Pp, Ppk, adStats, trend, isNormal, tolerance: usl - lsl, subSize, subgroups, targetCpk, lsl, usl };
    runExpertAnalysis(statsContext, dim);

    let warnings = [];
    if (Cpk < targetCpk) { warnings.push(`<strong>Low Capability:</strong> Cpk is ${Cpk.toFixed(2)} (Target > ${targetCpk}).`); }
    if (!isNormal) {
        const analysisObj = { 
            isMultimodal: (cavMode === 'all' && [...new Set(data.map(d=>d.cavity))].length > 1), 
            hasTrend: currentAiState.hasTrend, 
            featureName: dim, 
            cavityCount: (cavMode === 'all' ? 2 : 1) 
        };
        const specificSuggestion = getNormalitySuggestion(analysisObj);
        warnings.push(`<strong>Non-Normal Data:</strong> P-Value ${adStats.p.toFixed(3)}. ${specificSuggestion}`);
        if (currentOutliers.length > 0) { 
            remBtn.textContent = `Review ${currentOutliers.length} Outliers`; 
            remBtn.classList.remove('hidden'); 
        }
    }
    if (warnings.length > 0 || ignoredIds.size > 0) { warningText.innerHTML = warnings.join('<br>'); warningDiv.classList.remove('hidden'); }

    const outlierSet = new Set(currentOutliers);
    renderControlCharts(chartType, subgroups, overallMean, withinStDev, subSize, outlierSet);
    renderRunChart(subgroups, overallMean, usl, lsl, outlierSet);
    renderHistogram(allValues, overallMean, overallStDev, withinStDev, lsl, usl);
    renderProbPlot(allValues, adStats);
    renderStatsPanel(Cp, Cpk, Pp, Ppk, overallMean, overallStDev, withinStDev, adStats, allValues.length, lsl, usl, nominal, ppkIsPercentile, Pp_Norm, Ppk_Norm);
    
if(typeof updateDrawingButtonVisibility === 'function') updateDrawingButtonVisibility();
    if(isLightMode) setTimeout(applyThemeToCharts, 50);
    }

function updateSPC() {
    const uniqueDims = [...new Set(globalData.map(d => d.element))];
    if (uniqueDims.length === 0) return;
    const unit = document.getElementById('unitSelect').value;
    const runStats = {};
    const variationSummary = { totalCp: 0, cpCount: 0, totalSignals: 0 };
    const dimensionRisks = [];
    let allRunNames = new Set();

    const riskDefinitions = {
        "Process Variation": "PROCESS VARIATION (Cp < 1.0): The within-shot spread is too wide — the bell curve exceeds the tolerance even if perfectly centered. You cannot fix this by adjusting the mean or cutting steel. Priority actions: (1) Stabilize the Range/MR chart, (2) Inspect check ring and cushion, (3) Run a gate freeze study, (4) Verify clamp tonnage. Re-measure only after Cp improves.",
        "Tooling Centering": "TOOLING CENTERING: The process is repeatable (good Cp) but the average is shifted toward one spec limit. This is the correct condition for a tooling or process mean adjustment. Use steel-safe rules: cut steel on cores to open holes, plate/weld cavities to grow external features. Confirm Range chart stability before any steel work.",
        "Instability": "INSTABILITY (Special Cause): Individual shots or cavities are consuming more than 75% of the tolerance — often due to flyers (short shots, flash, contamination). Do not adjust the process mean. Instead: (1) Find the specific outlier shots on the Run Chart, (2) Physically inspect those parts, (3) Determine root cause, (4) Remove confirmed defects from the dataset, (5) Implement a countermeasure.",
        "Marginal": "MARGINAL (Passing but Tight): The dimension is currently in spec but using a large share of the tolerance window. Any drift in mean or increase in variation will likely produce defects. Proactively monitor this dimension each run and prioritize it before it becomes a failure."
    };

    uniqueDims.forEach(dim => {
        let dimData = globalData.filter(d => d.element === dim);
        const rec = dimData[0];
        if (!rec) return;
        const tolerance = rec.usl - rec.lsl;
        const target = rec.nominal;
        const runs = [...new Set(dimData.map(d => d.run || "No Run"))];
        
        let dimRisk = { dim: dim, type: (rec.description || 'Basic'), worseRun: '', maxTolUsed: 0, driver: '', explanation: '' };

        runs.forEach(run => {
            if (!activeRunFilter.has(run)) return;
            allRunNames.add(run);
            const runData = dimData.filter(d => (d.run || "No Run") === run);
            
            const usages = runData.map(d => {
                if (d.value >= target) {
                    return ((d.value - target) / (rec.usl - target)) * 100;
                } else {
                    return ((target - d.value) / (target - rec.lsl)) * 100;
                }
            });
            
            const avgUsage = jStat.mean(usages);
            const values = runData.map(d => d.value);
            const meanVal = jStat.mean(values);
            const stdVal = jStat.stdev(values, true);
            const cp = stdVal > 0 ? tolerance / (6 * stdVal) : 0;

            if(cp > 0) { variationSummary.totalCp += cp; variationSummary.cpCount++; }
            if (!runStats[run]) runStats[run] = { sumUsage: 0, count: 0, signals: 0 };
            runStats[run].sumUsage += avgUsage;
            runStats[run].count++;
            
            const signals = usages.filter(u => u > 75).length;
            runStats[run].signals += signals;
            variationSummary.totalSignals += signals;

            if (avgUsage > dimRisk.maxTolUsed) {
                dimRisk.maxTolUsed = avgUsage;
                dimRisk.worseRun = run;
                const shift = meanVal - target;
                
                let pctShift = 0;
                if (meanVal >= target) {
                    pctShift = ((meanVal - target) / (rec.usl - target)) * 100;
                } else {
                    pctShift = ((target - meanVal) / (target - rec.lsl)) * 100;
                }

                if (cp < 1.0) { dimRisk.driver = "Process Variation"; dimRisk.explanation = `High spread (Cp ${cp.toFixed(2)}).`; }
                else if (pctShift > 50) { dimRisk.driver = "Tooling Centering"; dimRisk.explanation = `Shifted ${shift.toFixed(4)}${unit}.`; }
                else if (signals > 0) { dimRisk.driver = "Instability"; dimRisk.explanation = `${signals} outliers.`; }
                else { dimRisk.driver = "Marginal"; dimRisk.explanation = "Stable but tight."; }
            }
        });
        if(dimRisk.worseRun) dimensionRisks.push(dimRisk);
    });

    const runKeys = Object.keys(runStats);
    let verdictHTML = "";
    if (runKeys.length > 1) {
        const metrics = runKeys.map(r => ({ run: r, avg: runStats[r].sumUsage / runStats[r].count })).sort((a,b) => a.avg - b.avg);
        verdictHTML = `Run <strong class="text-green-400">${metrics[0].run}</strong> is more stable than Run <strong class="text-red-400">${metrics[metrics.length - 1].run}</strong>.`;
    } else if (runKeys.length === 1) {
        const r = runKeys[0];
        verdictHTML = `Run <strong>${r}</strong> consumes <strong>${(runStats[r].sumUsage / runStats[r].count).toFixed(1)}%</strong> of tolerance.`;
    } else { verdictHTML = "No runs selected."; }
    document.getElementById('spcVerdict').innerHTML = verdictHTML;

    const avgCp = variationSummary.cpCount > 0 ? variationSummary.totalCp / variationSummary.cpCount : 0;
    const commonEl = document.getElementById('spcCommonCause');
    const specialEl = document.getElementById('spcSpecialCause');
    if (avgCp >= 1.33) {
        commonEl.innerHTML = `<p class="text-green-400 font-bold">Low System Noise (Avg Cp: ${avgCp.toFixed(2)})</p>
            <p class="text-xs text-slate-300 mt-1">Across the selected runs, within-subgroup variation is small relative to tolerances. The machine and mold are repeating shots consistently. Focus improvement efforts on centering (off-target means) rather than variation reduction.</p>`;
    } else if (avgCp >= 1.0) {
        commonEl.innerHTML = `<p class="text-yellow-400 font-bold">Marginal System Noise (Avg Cp: ${avgCp.toFixed(2)})</p>
            <p class="text-xs text-slate-300 mt-1">The process is using most of the available tolerance band for spread. It may be capable today but has limited margin for drift or tool wear. Monitor closely and prioritize dimensions with the highest tolerance consumption in the Risk Ranking table.</p>`;
    } else {
        commonEl.innerHTML = `<p class="text-red-400 font-bold">High System Noise (Avg Cp: ${avgCp.toFixed(2)})</p>
            <p class="text-xs text-slate-300 mt-1">Common-cause variation is too high — the bell curve is wider than the tolerance allows. Process parameter tweaks to center the mean will not fix this. Investigate check ring wear, cushion stability, gate freeze timing, and clamp tonnage before making any tooling changes.</p>`;
    }

    if (variationSummary.totalSignals === 0) {
        specialEl.innerHTML = `<p class="text-green-400 font-bold">No Special Cause Signals</p>
            <p class="text-xs text-slate-300 mt-1">No individual shots or cavities exceeded 75% tolerance consumption. The process is free of the large outlier events that typically indicate short shots, flash, or contamination. Continue routine monitoring.</p>`;
    } else {
        specialEl.innerHTML = `<p class="text-red-400 font-bold">Special Cause Detected</p>
            <p class="text-xs text-slate-300 mt-1">Found <strong>${variationSummary.totalSignals}</strong> measurement(s) consuming &gt;75% of tolerance — assignable special-cause events, not random noise. Identify the specific shots on the Run Chart, inspect those parts, determine root cause, and remove confirmed defects before recalculating capability.</p>`;
    }

    const tbodyCav = document.getElementById('spcCavityBody');
    tbodyCav.innerHTML = "";
    const aggCavStats = {}; 
    globalData.forEach(d => {
        const run = d.run || "No Run";
        if (!activeRunFilter.has(run)) return;
        const key = `${run}__${d.cavity}`;
        const dimRec = globalData.find(x => x.element === d.element);
        if(dimRec) {
            const tol = dimRec.usl - dimRec.lsl;
            const target = dimRec.nominal;
            const usage = (Math.abs(d.value - target) / (tol/2)) * 100;
            if(!aggCavStats[key]) aggCavStats[key] = { sum: 0, count: 0, run: run, cav: d.cavity };
            aggCavStats[key].sum += usage;
            aggCavStats[key].count++;
        }
    });
    Object.values(aggCavStats).sort((a,b) => a.run.localeCompare(b.run) || a.cav - b.cav).forEach(stat => {
        const avg = stat.sum / stat.count;
        let stab = "Stable", color = "text-green-400";
        if (avg > 75) { stab = "High Risk"; color = "text-red-400 font-bold"; }
        else if (avg > 50) { stab = "Drifting"; color = "text-yellow-400"; }
        tbodyCav.innerHTML += `<tr class="bg-slate-800 border-b border-slate-700"><td class="px-4 py-3">${stat.run}</td><td class="px-4 py-3">${stat.cav}</td><td class="px-4 py-3">${avg.toFixed(1)}%</td><td class="px-4 py-3 ${color}">${stab}</td></tr>`;
    });

    const tbodyRisk = document.getElementById('spcRiskBody');
    tbodyRisk.innerHTML = "";
    dimensionRisks.sort((a,b) => b.maxTolUsed - a.maxTolUsed).forEach(item => {
        let barColor = item.maxTolUsed > 90 ? "bg-red-500" : (item.maxTolUsed > 70 ? "bg-yellow-500" : "bg-green-500");
        const tooltipText = riskDefinitions[item.driver] || "Risk analysis based on tolerance usage.";
        
        // CHANGED: 'text-white' updated to 'text-slate-100' for theme visibility
        tbodyRisk.innerHTML += `
            <tr class="bg-slate-800 border-b border-slate-700 hover:bg-slate-700">
                <td class="px-6 py-3 font-bold text-slate-100">DIM ${item.dim}</td>
                <td class="px-6 py-3 text-xs uppercase text-slate-400">${item.type}</td>
                <td class="px-6 py-3 font-mono text-slate-300">${item.worseRun}</td>
                <td class="px-6 py-3">
                    <div class="w-full bg-slate-900 rounded-full h-2.5 mb-1">
                        <div class="${barColor} h-2.5 rounded-full" style="width: ${Math.min(item.maxTolUsed, 100)}%"></div>
                    </div>
                    <span class="text-xs font-mono">${item.maxTolUsed.toFixed(1)}%</span>
                </td>
                <td class="px-6 py-3 text-sm font-bold text-slate-200 cursor-help underline decoration-dotted decoration-slate-500" title="${tooltipText}">${item.driver}</td>
                <td class="px-6 py-3 text-xs text-slate-400 italic">${item.explanation}</td>
            </tr>`;
    });
    
    const physicsDiv = document.getElementById('spcPhysicsBody');
    const varDrivers = dimensionRisks.filter(d => d.driver.includes("Variation")).length;
    const centerDrivers = dimensionRisks.filter(d => d.driver.includes("Centering")).length;
    let interp = "";
    if (varDrivers > centerDrivers) {
        interp += `<div class="flex gap-3"><i class="fa-solid fa-compress text-red-400 mt-1"></i><div><h4 class="font-bold text-red-400">Pressure / Repeatability Problem</h4>
            <p class="text-xs text-slate-300 mt-1">Most flagged dimensions show wide spread (low Cp) — the machine cannot repeat the same fill and pack shot after shot. This is a variation problem, not a centering problem.</p>
            <p class="text-xs text-slate-400 mt-2"><strong>Priority actions:</strong> (1) Inspect and replace worn check ring, (2) Log and stabilize cushion, (3) Run gate freeze study, (4) Verify clamp tonnage. Do not cut steel until Cp is acceptable.</p></div></div>`;
    } else {
        interp += `<div class="flex gap-3"><i class="fa-solid fa-tools text-orange-400 mt-1"></i><div><h4 class="font-bold text-orange-400">Tooling / Centering Problem</h4>
            <p class="text-xs text-slate-300 mt-1">Most flagged dimensions are repeatable (acceptable Cp) but off nominal — the mold steel or setup is at the wrong size. This is the correct condition for tooling adjustment.</p>
            <p class="text-xs text-slate-400 mt-2"><strong>Priority actions:</strong> (1) Confirm Range chart is stable, (2) Try hold pressure / cooling adjustment for small shifts, (3) Plan steel-safe tooling change for large shifts. Document mean, nominal, and direction before cutting.</p></div></div>`;
    }
    physicsDiv.innerHTML = interp;
}

function refreshSixPackCavities() {
    const dim = document.getElementById('spDimSelect').value;
    const cavSelect = document.getElementById('spCavSelect');
    const currentSelection = cavSelect.value;
    while (cavSelect.options.length > 1) { cavSelect.remove(1); }
    if (!dim) return;
    let data = globalData.filter(d => d.element === dim && !ignoredIds.has(d._id));
    data = data.filter(d => activeRunFilter.has(d.run || "No Run")); 
    const validSeries = [...new Set(data.map(d => getSeriesLabel(d)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    validSeries.forEach(s => { const opt = document.createElement("option"); opt.value = s; opt.text = s; cavSelect.appendChild(opt); });
    if (currentSelection === 'all' || validSeries.includes(currentSelection)) cavSelect.value = currentSelection; 
    else cavSelect.value = 'all';
}
function updateSummary() {
    const tbody = document.getElementById('summaryTableBody');
    const noIssues = document.getElementById('noIssuesMessage');
    const targetCpk = parseFloat(document.getElementById('targetCpkInput').value) || 1.33;
    
    if (!tbody || !noIssues) return;
    
    tbody.innerHTML = '';
    let issueCount = 0;
    
    const uniqueDims = [...new Set(globalData.map(d => d.element))];
    
    uniqueDims.forEach(dim => {
        // Filter data by dimension and currently selected runs
        let dimData = globalData.filter(d => d.element === dim && activeRunFilter.has(d.run || "No Run"));
        if (dimData.length === 0) return;
        
        const rec = dimData[0];
        const tol = rec.usl - rec.lsl;
        const target = rec.nominal;
        const adj = adjustments[dim] || 0;
        
        // Create a safe ID for the accordion toggles
        const groupId = `group-${dim.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        const seriesList = [...new Set(dimData.map(d => getSeriesLabel(d)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        let dimIssues = [];
        
        seriesList.forEach(series => {
            const seriesData = dimData.filter(d => getSeriesLabel(d) === series);
            const values = seriesData.map(d => d.value + adj);
            if (values.length < 2) return;
            
            const mean = jStat.mean(values);
            const stdev = jStat.stdev(values, true);
            const cp = stdev > 0 ? tol / (6 * stdev) : 0;
            
            let cpu = (rec.usl - mean) / (3 * stdev);
            let cpl = (mean - rec.lsl) / (3 * stdev);
            let cpk = Math.min(cpu, cpl);
            
            // Flag an issue if Cpk is below the target threshold
            if (cpk < targetCpk) {
                issueCount++;
                let issueType = "";
                let nextStep = "";
                
                if (cp < targetCpk) {
                    issueType = "Variation Too High (Cp < Target)";
                    nextStep = "<strong>Step 1:</strong> Stabilize the Range/MR chart — inspect check ring, log cushion, verify hold pressure repeatability. <strong>Step 2:</strong> Run a gate freeze study if pack-related. <strong>Step 3:</strong> Confirm gauge resolution meets the 10:1 rule. Do not center the mean until Cp meets target.";
                } else {
                    issueType = mean > target ? "Mean Shifted High (Oversize)" : "Mean Shifted Low (Undersize)";
                    nextStep = mean > target
                        ? "<strong>Step 1:</strong> Confirm Range chart is in control (process is stable). <strong>Step 2:</strong> Try reducing hold/pack pressure or increasing cooling time to reduce shrinkage. <strong>Step 3:</strong> If shift is large, plan steel-safe tooling — cut cavity steel or plate core pin per direction rules."
                        : "<strong>Step 1:</strong> Confirm Range chart is in control (process is stable). <strong>Step 2:</strong> Try increasing hold/pack pressure or reducing cooling time. <strong>Step 3:</strong> If shift is large, plan steel-safe tooling — plate cavity or cut core pin per direction rules.";
                }
                
                dimIssues.push({
                    label: series,
                    issue: issueType,
                    metrics: `Cpk: ${cpk.toFixed(2)} | Mean: ${mean.toFixed(3)}`,
                    nextSteps: nextStep,
                    ref: `Target Cpk: ${targetCpk}`
                });
            }
        });
        
        // If issues exist for this dimension, render the header and the individual cavity rows
        if (dimIssues.length > 0) {
            const cat = rec.description || 'Basic';
            addDimensionHeaderRow(dim, cat, groupId);
            dimIssues.forEach(issue => {
                addCavityIssueRow(dim, issue, groupId);
            });
        }
    });
    
    // Toggle the empty state message vs the table visibility
    if (issueCount === 0) {
        tbody.parentElement.classList.add('hidden');
        noIssues.classList.remove('hidden');
    } else {
        tbody.parentElement.classList.remove('hidden');
        noIssues.classList.add('hidden');
    }
}



// ==========================================
// PROJECT LOAD/SAVE & OUTLIERS
// ==========================================

function resetOutliers() { ignoredIds.clear(); updateSixPack(); }
function removeOutliers() { if (currentOutliers.length > 0) reviewAndRemoveOutliers(); }

function reviewAndRemoveOutliers() {
    const modal = document.getElementById('graph-help-modal');
    document.getElementById('modal-title').textContent = "Confirm Outlier Removal";
    
    let tableRows = '';
    const outliersData = globalData.filter(d => currentOutliers.includes(d._id));
    
    outliersData.slice(0, 10).forEach(d => {
        const adj = adjustments[d.element] || 0;
        const val = (d.value + adj).toFixed(4);
        tableRows += `<tr class="border-b border-slate-700">
            <td class="py-2 px-2 text-slate-300">${d.run || '-'}</td>
            <td class="py-2 px-2 text-slate-300">Cav ${d.cavity}</td>
            <td class="py-2 px-2 text-slate-300 text-center">${d.sample}</td>
            <td class="py-2 px-2 font-bold text-red-400">${val}</td>
        </tr>`;
    });

    if (outliersData.length > 10) { tableRows += `<tr><td colspan="4" class="py-2 text-center text-slate-500 italic">...and ${outliersData.length - 10} more</td></tr>`; }

    const html = `<div class="space-y-4"><p class="text-slate-300 text-sm">The IQR method identified <strong>${outliersData.length}</strong> data points as statistical outliers. Removing them will recalculate Cpk/Ppk.</p><div class="max-h-60 overflow-y-auto bg-slate-900 rounded border border-slate-700 p-2"><table class="w-full text-xs text-left"><thead class="text-slate-500 uppercase font-bold border-b border-slate-600"><tr><th class="py-1 px-2">Run</th><th class="py-1 px-2">Cavity</th><th class="py-1 px-2 text-center">Sample</th><th class="py-1 px-2">Value</th></tr></thead><tbody>${tableRows}</tbody></table></div><div class="flex justify-end gap-3 pt-2"><button onclick="document.getElementById('graph-help-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors">Cancel</button><button onclick="confirmOutlierRemoval()" class="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded shadow-lg transition-colors flex items-center gap-2"><i class="fa-solid fa-trash-can"></i> Confirm Removal</button></div></div>`;
    document.getElementById('modal-content').innerHTML = html;
    modal.classList.remove('hidden');
}

window.confirmOutlierRemoval = function() {
    currentOutliers.forEach(id => ignoredIds.add(id));
    document.getElementById('graph-help-modal').classList.add('hidden');
    updateSixPack();
};

function resetAndUpdateSixPack() { 
    ignoredIds.clear(); 
    updateSixPack(); 
}

function addDimensionHeaderRow(dimLabel, category, groupId) {
    const tbody = document.getElementById('summaryTableBody');
    const headerTr = document.createElement('tr');
    
    headerTr.className = "bg-slate-900/50 cursor-pointer hover:bg-slate-900/70 transition-colors border-b border-slate-700/30";
    headerTr.onclick = () => toggleGroup(groupId);

    // Normalize to uppercase so "Critical" or "CRITICAL" both work
    const upperCat = category.toUpperCase();
    let badgeClass = "";

    if (upperCat.includes('CRITICAL')) {
        // Red Theme for Critical
        badgeClass = "bg-red-500/20 text-red-500 border-red-500/40";
    } else if (upperCat.includes('FAI')) {
        // Purple Theme for FAI
        badgeClass = "bg-purple-500/20 text-purple-500 border-purple-500/40";
    } else {
        // Default Slate Theme for others
        badgeClass = "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }

    const badgeHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${category}</span>`;

    headerTr.innerHTML = `
        <td colspan="7" class="px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <i class="fa-solid fa-chevron-right text-slate-400 text-xs transition-transform" id="icon-${groupId}"></i>
                    <span class="font-bold text-slate-100 tracking-tight">${dimLabel}</span>
                    ${badgeHtml}
                </div>
                <span class="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">${category} Analysis</span>
            </div>
        </td>
    `;
    tbody.appendChild(headerTr);
}

function addCavityIssueRow(dimKey, issueData, groupId) {
    const tbody = document.getElementById('summaryTableBody');
    const tr = document.createElement('tr');
    
    // Maintain zebra striping logic
    tr.className = `bg-slate-800 hover:bg-slate-750 transition-colors border-b border-slate-700/30 even:bg-[rgba(0,0,0,0.1)] ${groupId} hidden`;
    
    const catClass = issueData.issue.includes('FAI') ? 'text-purple-400' : 'text-red-400';
    const safeLabel = issueData.label.replace(/'/g, "\\'");
    
    // FIX: Changed the first TD to 'text-slate-100' for the Cavity Name visibility
    tr.innerHTML = `
        <td class="px-6 py-3 text-left font-medium text-slate-100 pl-12 border-l-4 border-slate-700">${issueData.label}</td>
        <td class="px-6 py-3 text-left text-slate-500 text-xs uppercase tracking-wider">-</td>
        <td class="px-6 py-3 text-left ${catClass} font-medium text-sm">${issueData.issue}</td>
        <td class="px-6 py-3 text-right font-mono text-xs text-slate-400">${issueData.metrics}</td>
        <td class="px-6 py-3 text-left text-xs text-slate-300 bg-slate-900/50 rounded border-l-2 border-slate-600 p-2">${issueData.nextSteps}</td>
        <td class="px-6 py-3 text-left text-xs text-slate-500 italic">${issueData.ref}</td>
        <td class="px-6 py-3 text-center"><button onclick="inspectDimension('${dimKey}', '${safeLabel}')" class="text-blue-400 hover:text-blue-300 text-sm font-medium hover:underline">Inspect</button></td>
    `;
    tbody.appendChild(tr);
}

function toggleGroup(groupId) { 
    const rows = document.querySelectorAll(`.${groupId}`); 
    const icon = document.getElementById(`icon-${groupId}`); 
    rows.forEach(row => { row.classList.toggle('hidden'); }); 
    if (icon) { icon.style.transform = icon.style.transform === 'rotate(-90deg)' ? 'rotate(0deg)' : 'rotate(-90deg)'; } 
}

window.inspectDimension = function(dim, seriesLabel) {
    const rec = globalData.find(d => d.element === dim); 
    const isCritical = rec && rec.description && rec.description.toLowerCase().includes('critical'); 
    if (isCritical) { 
        document.getElementById('spDimSelect').value = dim; 
        initRunFilter('sixpack', dim); 
        refreshSixPackCavities(); 
        document.getElementById('spCavSelect').value = seriesLabel; 
        const adj = adjustments[dim] || 0; 
        document.getElementById('steelAdjSp').value = adj.toFixed(3); 
        switchTab('sixpack'); 
    } else { 
        document.getElementById('typeFilter').value = rec.description; 
        handleTypeFilterChange(); 
        document.getElementById('dimSelect').value = dim; 
        initRunFilter('std', dim); 
        initSeriesFilter(dim); 
        activeSeriesFilter.clear(); 
        activeSeriesFilter.add(seriesLabel); 
        updateFilterLabel(); 
        const checkboxes = document.querySelectorAll('#seriesFilterContent input[type="checkbox"]'); 
        checkboxes.forEach(cb => { 
            if (cb.id === `chk-${seriesLabel}`) cb.checked = true; 
            else if (cb.id !== 'chk-all') cb.checked = false; 
        }); 
        const allChk = document.getElementById('chk-all'); 
        if(allChk) allChk.checked = false; 
        const adj = adjustments[dim] || 0; 
        document.getElementById('steelAdjStd').value = adj.toFixed(3); 
        switchTab('standard'); 
    }
};


function showView(viewId) {
    if (viewId === 'viewPdfWizard') {
        openPdfWizardFromHeader();
    }
}

// ==========================================
// INSIGHT & SIDEBAR LOGIC
// ==========================================

window.showInsight = function(chartId) {
    try {
        // Read safely from the new global state
        const insight = window.currentInsights[chartId];
        
        if(!insight) {
            console.warn("No insight mapped for: " + chartId);
            return;
        }
        
        const sidebar = document.getElementById('ai-helper-sidebar');
        const content = document.getElementById('ai-content-area');
        
        if (!sidebar || !content) return;

        // Ensure tips array doesn't crash the .map() function
        const safeTips = Array.isArray(insight.tips) ? insight.tips : [];

        let html = `
            <div class="ai-helper-content">
                <h3 class="text-white border-b border-slate-700 pb-2 mb-4">
                    <i class="fa-solid fa-microscope text-blue-400 mr-2"></i>Expert Analysis
                </h3>
                <p class="font-bold text-amber-400 mb-2">${insight.title}</p>
                
                <div class="bg-slate-800 p-4 rounded border border-amber-600/30 mb-4">
                    <h4 class="text-xs font-bold text-slate-400 uppercase mb-2">Observation</h4>
                    <p class="text-sm text-slate-200">${insight.observation}</p>
                </div>

                <div class="bg-blue-900/20 p-4 rounded border border-blue-600/30">
                    <h4 class="text-xs font-bold text-blue-300 uppercase mb-2">
                        <i class="fa-solid fa-wrench mr-2"></i>Troubleshooting Tips
                    </h4>
                    <ul class="list-disc list-outside ml-4 space-y-2 text-sm text-slate-200">
                        ${safeTips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;

        content.innerHTML = html;
        sidebar.classList.add('open');
        
    } catch (err) {
        console.error("Error opening insight sidebar:", err);
    }
};

Object.assign(window, {
  generateTemplate,
  updateRunNameInputs,
  showMainApp,
  openPdfWizardFromHeader,
  saveProject,
  exportStandardAnalysisSlideDeck,
  toggleLightMode,
  switchTab,
  openAiHelper,
  closeAiHelper,
  showChartHelp,
  toggleChartFullscreen,
  skipPdfImport,
  startPdfWizard,
  changePdfPage,
  zoomPdf,
  handleFileSelect,
  startRetake,
  setupReticle,
  executeSurgicalCapture,
  renderWizardList,
  wizardSkipStep,
  finishWizard,
  toggleRunDropdown,
  handleTypeFilterChange,
  handleDimensionChange,
  resetAndUpdateSixPack,
  resetOutliers,
  removeOutliers,
  updateSummary,
  updateSPC,
  toggleGroup,
});

deferred.initUI = initUI;
deferred.showMainApp = showMainApp;
deferred.closePdfWizard = closePdfWizard; // from ./pdf/wizard.js
deferred.triggerAfterExcelUpload = triggerAfterExcelUpload;
deferred.updateDashboard = updateDashboard;
deferred.updateSixPack = updateSixPack;
globalThis.handleSeriesFilterChange = handleSeriesFilterChange;
globalThis.handleTypeFilterChange = handleTypeFilterChange;
globalThis.initRunFilter = initRunFilter;
globalThis.updateDashboard = updateDashboard;
globalThis.updateSixPack = updateSixPack;
globalThis.updateSPC = updateSPC;
globalThis.updateSummary = updateSummary;
