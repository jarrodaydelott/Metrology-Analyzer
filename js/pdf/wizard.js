/* global pdfjsLib */
import {
  globalData,
  dimensionImages,
  pdfDoc,
  pdfPageNum,
  pdfScale,
  wizardDims,
  currentWizardIndex,
  targetCaptureDim,
} from "../state.js";
import { LENS_W, LENS_H } from "../constants.js";
import { deferred } from "../app-delegates.js";
import { updateDrawingButtonVisibility } from "../ui/drawing-popup.js";


// ==========================================
// 8. FLOATING LENS & WIZARD PDF SYSTEM (Ver 2.8)
// ==========================================

/** 1. TRAFFIC CONTROL & INITIAL WIZARD **/

export function triggerAfterExcelUpload() {
    if (Object.keys(dimensionImages).length > 0) {
        deferred.initUI();
    } else {
        const prompt = document.getElementById('pdf-prompt-modal');
        if (prompt) prompt.classList.remove('hidden');
        else deferred.initUI();
    }
}

export function skipPdfImport() {
    document.getElementById('pdf-prompt-modal').classList.add('hidden');
    deferred.initUI();
}

export function openPdfWizardFromHeader() {
    // If a PDF is already loaded in memory, skip the upload prompt
    // and jump straight back into the checklist modal
    if (typeof pdfDoc !== 'undefined' && pdfDoc !== null) {
        document.getElementById('pdf-wizard-modal').classList.remove('hidden');
        renderWizardList(); // Refreshes the list so your green checkmarks show up
    } else {
        // If no PDF has been uploaded yet, show the initial starting prompt
        document.getElementById('pdf-prompt-modal').classList.remove('hidden');
    }
}

export async function startPdfWizard(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('pdf-prompt-modal').classList.add('hidden');
    document.getElementById('pdf-wizard-modal').classList.remove('hidden');
    
    wizardDims = [...new Set(globalData.map(d => d.element))];
    currentWizardIndex = 0;
    renderWizardList();
    
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        try {
            pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
            document.getElementById('pdf-page-count').textContent = pdfDoc.numPages;
            pdfPageNum = 1; 
            renderPdfPage(1);
        } catch (err) {
            alert("Error parsing PDF.");
            closePdfWizard();
        }
    };
    fileReader.readAsArrayBuffer(file);
    e.target.value = ''; 
}

export function wizardSkipStep() {
  currentWizardIndex++;
  renderWizardList();
}

export function renderWizardList() {
    const list = document.getElementById('wizard-dim-list');
    if (!list) return;
    list.innerHTML = '';
    
    const pct = (currentWizardIndex / wizardDims.length) * 100;
    document.getElementById('wizard-progress').style.width = `${pct}%`;

    wizardDims.forEach((dim, idx) => {
        const isCurrent = idx === currentWizardIndex;
        const hasImg = !!dimensionImages[dim];
        const div = document.createElement('div');
        div.className = `p-3 rounded-lg border flex items-center justify-between transition-all ${isCurrent ? 'bg-blue-900/40 border-blue-500 shadow-md' : (hasImg ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/50 border-transparent opacity-60')}`;
        
        let imgHtml = hasImg ? `<img src="${dimensionImages[dim]}" class="h-8 w-10 object-cover rounded border border-slate-600">` : `<div class="h-8 w-10 bg-slate-700 rounded flex items-center justify-center border border-slate-600"><i class="fa-regular fa-image text-slate-500 text-xs"></i></div>`;
        
        div.innerHTML = `
            <div class="flex items-center gap-3">
                ${imgHtml}
                <div>
                    <div class="font-bold text-sm ${isCurrent ? 'text-blue-400' : 'text-slate-300'}">DIM ${dim}</div>
                    <div class="text-[10px] ${hasImg ? 'text-green-400' : 'text-slate-500'}">${hasImg ? 'Captured' : 'Pending'}</div>
                </div>
            </div>
            <div class="flex gap-2">
                ${hasImg && !isCurrent ? `<button onclick="retakeDrawing(${idx})" class="text-xs text-blue-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-blue-900 transition-colors"><i class="fa-solid fa-camera-rotate mr-1"></i>Retake</button>` : ''}
                ${isCurrent ? `<button onclick="wizardSkipStep()" class="text-xs text-slate-400 hover:text-white px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 transition-colors">Skip</button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (currentWizardIndex >= wizardDims.length) {
        document.getElementById('wizard-instruction').innerHTML = `<span class="text-green-400 font-bold"><i class="fa-solid fa-check-circle mr-2"></i>All dimensions processed. Click Finish.</span>`;
    }
}

window.retakeDrawing = function(idx) {
    currentWizardIndex = idx;
    renderWizardList();
};

export function closePdfWizard() {
    document.getElementById('pdf-wizard-modal').classList.add('hidden');
    deferred.initUI(); 
}

/** 2. FLOATING LENS INTERACTION (SETUP TAB) **/

export function startRetake(dimId) {
    targetCaptureDim = dimId;
    const viewfinder = document.getElementById('pdf-viewfinder-setup');
    const wrapper = document.getElementById('pdf-wrapper');
    const badge = document.getElementById('capture-status-badge');
    
    if (!viewfinder || !wrapper) return;
    viewfinder.style.display = 'block';

    if (badge) {
        badge.innerHTML = `<i class="fa-solid fa-camera mr-2"></i> CAPTURING DIM ${dimId}`;
        badge.className = "px-3 py-1 bg-orange-900/50 text-orange-400 border border-orange-700 rounded-full text-xs font-bold uppercase tracking-wider";
    }

    // MOUSE TRACKING: Cursor is at the center of the lens
    wrapper.onmousemove = (e) => {
        const rect = wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        viewfinder.style.left = (x - (LENS_W / 2)) + 'px';
        viewfinder.style.top = (y - (LENS_H / 2)) + 'px';
    };

    // ONE-CLICK CAPTURE
    wrapper.onclick = (e) => {
        if (targetCaptureDim) {
            executeSurgicalCapture();
            e.stopPropagation();
        }
    };
}

/** 3. HIGH-RES CAPTURE LOGIC **/

export function setupReticle() {
    const canvas = document.getElementById('pdf-canvas');
    const reticle = document.getElementById('pdf-reticle');
    if (!canvas || !reticle) return;
    reticle.style.display = 'block';
    
    canvas.onmousemove = (e) => {
        const rect = canvas.parentElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        reticle.style.left = `${x - 125}px`;
        reticle.style.top = `${y - 100}px`;
    };

    canvas.onclick = (e) => {
        if (currentWizardIndex >= wizardDims.length) return;
        
        // Capture the image
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1200; tempCanvas.height = 1000;
        const cropW = 250 * scaleX; const cropH = 200 * scaleY;
        
        const tCtx = tempCanvas.getContext('2d');
        tCtx.fillStyle = '#FFFFFF';
        tCtx.fillRect(0, 0, 1200, 1000);
        tCtx.drawImage(canvas, (e.clientX - rect.left) * scaleX - (cropW/2), (e.clientY - rect.top) * scaleY - (cropH/2), cropW, cropH, 0, 0, 1200, 1000);
        
        // Save the image
        dimensionImages[wizardDims[currentWizardIndex]] = tempCanvas.toDataURL('image/png', 1.0);
        
        // SMART NAVIGATION: Find the first dimension that doesn't have an image yet
        const nextMissingIndex = wizardDims.findIndex(dim => !dimensionImages[dim]);
        
        if (nextMissingIndex !== -1) {
            currentWizardIndex = nextMissingIndex; // Jump to the missing one
        } else {
            currentWizardIndex = wizardDims.length; // All done!
        }
        
        renderWizardList();
    };
}

export function executeSurgicalCapture() {
    if (!targetCaptureDim) return;

    const canvas = document.getElementById('pdf-canvas-setup');
    const viewfinder = document.getElementById('pdf-viewfinder-setup');
    
    const scaleX = canvas.width / canvas.offsetWidth;
    const scaleY = canvas.height / canvas.offsetHeight;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1200; 
    tempCanvas.height = 1000;
    const ctx = tempCanvas.getContext('2d');
    
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1200, 1000);

    ctx.drawImage(
        canvas,
        viewfinder.offsetLeft * scaleX,
        viewfinder.offsetTop * scaleY,
        LENS_W * scaleX,
        LENS_H * scaleY,
        0, 0, 1200, 1000
    );

    dimensionImages[targetCaptureDim] = tempCanvas.toDataURL('image/png', 1.0);

    stopCameraLens();
    refreshPdfDimList();
    updateDrawingButtonVisibility();
}

export function stopCameraLens() {
    targetCaptureDim = null;
    const viewfinder = document.getElementById('pdf-viewfinder-setup');
    const wrapper = document.getElementById('pdf-wrapper');
    const badge = document.getElementById('capture-status-badge');
    
    if (viewfinder) viewfinder.style.display = 'none';
    if (wrapper) {
        wrapper.onmousemove = null;
        wrapper.onclick = null;
    }
    if (badge) {
        badge.innerHTML = "Success! Capture Saved.";
        badge.className = "px-3 py-1 bg-green-900/50 text-green-400 border border-green-700 rounded-full text-xs font-bold uppercase tracking-wider";
    }
}

/** 4. RENDERING & HELPERS **/

export async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
        const pageDisp = document.getElementById('page-num-display');
        if (pageDisp) pageDisp.textContent = `Page 1 / ${pdfDoc.numPages}`;
        pdfPageNum = 1;
        renderPdfPage(1); 
    };
    fileReader.readAsArrayBuffer(file);
}

// SMART RENDER: Knows if we are in Setup Tab or Wizard Modal
export async function renderPdfPage(num) {
    if (!pdfDoc) return;
    
    const setupView = document.getElementById('viewPdfSetup');
    const isSetupTab = setupView && !setupView.classList.contains('hidden');
    const canvasId = isSetupTab ? 'pdf-canvas-setup' : 'pdf-canvas';
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const page = await pdfDoc.getPage(num);
    
    // 1. VISUAL SIZE (What you see on the screen via CSS)
    const visualViewport = page.getViewport({ scale: pdfScale });
    canvas.style.width = Math.floor(visualViewport.width) + 'px';
    canvas.style.height = Math.floor(visualViewport.height) + 'px';
    
    // 2. INTERNAL RESOLUTION (High-def data we actually capture)
    const renderScale = pdfScale * 4.0; 
    const internalViewport = page.getViewport({ scale: renderScale });
    
    canvas.width = Math.floor(internalViewport.width);
    canvas.height = Math.floor(internalViewport.height);
    
    await page.render({ canvasContext: ctx, viewport: internalViewport }).promise;
    
    if (!isSetupTab && typeof setupReticle === 'function') {
        setupReticle();
    }
}

export function zoomPdf(delta) {
    pdfScale = Math.min(Math.max(pdfScale + delta, 0.1), 5.0);
    
    const zoomDisp = document.getElementById('zoom-display');
    const zoomPercent = document.getElementById('zoom-percent');
    
    if (zoomDisp) zoomDisp.textContent = `${Math.round(pdfScale * 100)}%`;
    if (zoomPercent) zoomPercent.textContent = `${Math.round(pdfScale * 100)}%`;
    
    renderPdfPage(pdfPageNum);
}

export function changePdfPage(dir) {
    if (!pdfDoc) return;
    if (pdfPageNum + dir >= 1 && pdfPageNum + dir <= pdfDoc.numPages) {
        pdfPageNum += dir;
        const pageNumEl = document.getElementById('pdf-page-num');
        if (pageNumEl) pageNumEl.textContent = pdfPageNum;
        const pageDisp = document.getElementById('page-num-display');
        if (pageDisp) pageDisp.textContent = `Page ${pdfPageNum} / ${pdfDoc.numPages}`;
        renderPdfPage(pdfPageNum);
    }
}

export function refreshPdfDimList() {
    const list = document.getElementById('pdf-dim-list');
    if (!list) return;
    list.innerHTML = "";
    
    const uniqueDims = [...new Set(globalData.map(d => d.element))];
    
    uniqueDims.forEach(dimId => {
        const hasImg = !!dimensionImages[dimId];
        const row = document.createElement('div');
        
        row.className = `p-3 rounded-lg border flex justify-between items-center transition-all ${
            hasImg ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-800 border-slate-700'
        }`;
        
        row.innerHTML = `
            <div>
                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dimension</div>
                <div class="text-sm text-white font-mono font-bold">${dimId}</div>
            </div>
            <div class="flex items-center gap-3">
                ${hasImg ? '<i class="fa-solid fa-circle-check text-green-500 text-sm"></i>' : ''}
                <button onclick="startRetake('${dimId}')" 
                        class="px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-tighter transition-colors ${
                            hasImg ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }">
                    ${hasImg ? 'Retake' : 'Capture'}
                </button>
            </div>
        `;
        list.appendChild(row);
    });
}
// ==========================================
