/* global jStat, Plotly, PptxGenJS */

import { globalData, adjustments, activeRunFilter, dimensionImages } from "../state.js";
import {
  SLIDE_W_INCHES,
  SLIDE_H_INCHES,
  CHART_TARGET_H_INCHES,
  CHART_TARGET_W_INCHES,
  BRAND_DARK_BLUE,
  BRAND_ORANGE,
} from "../constants.js";
import { getSeriesLabel, getFullDimensionName } from "../utils/labels.js";
import { getChartSeriesPalette, getChartRefColors } from "../theme.js";

// --- NEW HELPER: Compresses massive PNG snippets to prevent PPTX memory crashes ---
export function prepareSnippetForPPTX(base64Str) {
            return new Promise((resolve) => {
                if (!base64Str) return resolve(null);
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 600; 
                    canvas.height = 500;
                    const ctx = canvas.getContext('2d');
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, 600, 500);
                    ctx.drawImage(img, 0, 0, 600, 500);
                    
                    const jpegStr = canvas.toDataURL('image/jpeg', 0.85);
                    resolve(jpegStr);
                };
                // FIX: Never fallback to the massive raw PNG. If it fails, return null.
                img.onerror = () => {
                    console.warn("Failed to compress snippet.");
                    resolve(null); 
                };
                img.src = base64Str;
            });
        }
// ==========================================
// PPTX EXPORT & AUTOMATION LOGIC
// ==========================================

export async function exportStandardAnalysisSlideDeck() {
            if (!globalData || globalData.length === 0) {
                alert("No data loaded. Cannot generate report.");
                return;
            }

            showExportOverlay();

            const pres = new PptxGenJS(); 
            
            // 1. Force True Modern Widescreen
            pres.defineLayout({ name: 'AptWidescreen', width: SLIDE_W_INCHES, height: SLIDE_H_INCHES });
            pres.layout = 'AptWidescreen';

            // 2. Dial in the Master Template Graphics
            pres.defineSlideMaster({
                title: 'COMPANY_TEMPLATE',
                background: { fill: 'FFFFFF' }, 
                objects: [
                    { rect: { x: 0, y: 0, w: 0.15, h: 3.75, fill: { color: BRAND_ORANGE } } }, 
                    { rect: { x: 0, y: 3.75, w: 0.15, h: 3.75, fill: { color: BRAND_DARK_BLUE } } },
                    { shape: pres.ShapeType.rtTriangle, x: 0, y: 3.60, w: 0.15, h: 0.15, fill: { color: BRAND_DARK_BLUE } }
                ]
            });

            const uniqueDims = [...new Set(globalData.map(d => d.element))];
            let processedCount = 0;
            const totalCount = uniqueDims.length;

            for (const dim of uniqueDims) {
                try {
                    // --- 1. SAFE STATS CALCULATION (MATCHING UI EXACTLY) ---
                    let currentDimData = globalData.filter(d => d.element === dim && activeRunFilter.has(d.run || "No Run"));
                    if (currentDimData.length === 0) continue;

                    const adj = adjustments[dim] || 0;
                    const vals = currentDimData.map(d => d.value + adj);
                    
                    // Calculate Mean
                    const meanVal = jStat.mean(vals).toFixed(4);
                    
                    // MATCH UI LOGIC: The UI calculates "Variance" as the Range (Max - Min)
                    const maxVal = Math.max(...vals);
                    const minVal = Math.min(...vals);
                    const varVal = (maxVal - minVal).toFixed(4);
                    
                    const countN = vals.length;

                    const percentComplete = Math.round((processedCount / totalCount) * 100);
                    updateExportStatusText(`Generating Slide ${processedCount + 1} of ${totalCount}... Processing DIM ${dim}`, percentComplete);

                    await new Promise(r => setTimeout(r, 10)); 

                    const b64Image = await renderStandardChartToImage(dim);
                    let slide = pres.addSlide({ masterName: 'COMPANY_TEMPLATE' });

                    // --- 2. HEADER & METRICS ROW INJECTION ---
                    // Added explicit W and H to prevent PptxGenJS from collapsing the text box
                    slide.addText(`DIM ${dim}`, { 
                        x: 0.6, y: 0.25, w: 5.0, h: 0.5, fontFace: 'Biome', fontSize: 32, color: BRAND_DARK_BLUE
                    });

                    const metricsStr = `MEAN: ${meanVal}   |   VARIANCE: ${varVal}   |   SAMPLES: ${countN}`;
                    slide.addText(metricsStr, {
                        x: 0.6, y: 0.80, w: 8.0, h: 0.4, fontFace: 'Segoe UI', fontSize: 12, bold: true, color: '475569'
                    });

                    // --- 3. DRAWING INJECTION ---
                    const dimKey = String(dim).trim().toUpperCase();
                    const rawSnip = dimensionImages[dimKey];
                    
                    if (rawSnip) {
                        const compressedSnip = await prepareSnippetForPPTX(rawSnip);
                        if (compressedSnip && compressedSnip.startsWith('data:image')) {
                            const snipW = 2.64; 
                            const snipH = 2.20; 
                            const snipX = SLIDE_W_INCHES - snipW - 0.6; 
                            const snipY = 0.25; 

                            slide.addImage({
                                data: rawSnip,
                                x: snipX, y: snipY, w: snipW, h: snipH,
                                rounding: false 
                            });

                            slide.addShape(pres.ShapeType.roundRect, {
                                x: snipX, y: snipY, w: snipW, h: snipH,
                                line: { color: 'CBD5E1', width: 1 }, 
                                rectRadius: 0.04
                            });
                        }
                    } else {
                        const snipW = 2.64; 
                        const snipH = 2.20; 
                        const snipX = SLIDE_W_INCHES - snipW - 0.6; 
                        const snipY = 0.25; 
                        slide.addShape(pres.ShapeType.rect, {
                            x: snipX, y: snipY, w: snipW, h: snipH, fill: { color: 'FFEBEB' }, line: { color: 'FF0000', width: 1.5 }
                        });
                        slide.addText(`DRAWING NOT FOUND\nIN MEMORY FOR:\nDIM ${dim}`, {
                            x: snipX, y: snipY, w: snipW, h: snipH, color: 'FF0000', fontSize: 12, align: 'center', bold: true
                        });
                    }

                    // --- 4. MAIN CHART INJECTION ---
                    const chartX = (SLIDE_W_INCHES / 2) - (CHART_TARGET_W_INCHES / 2);
                    const chartY = SLIDE_H_INCHES - CHART_TARGET_H_INCHES - 0.2;

                    slide.addShape(pres.ShapeType.roundRect, {
                        x: chartX, y: chartY, w: CHART_TARGET_W_INCHES, h: CHART_TARGET_H_INCHES,
                        fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 1 }, rectRadius: 0.04
                    });

                    slide.addImage({
                        data: b64Image,
                        x: chartX, y: chartY, w: CHART_TARGET_W_INCHES, h: CHART_TARGET_H_INCHES
                    });
                    
                    processedCount++;
                } catch (error) {
                    console.error(`Failed to generate slide for ${dim}`, error);
                }
            }

            updateExportStatusText(`Finalizing PowerPoint file...`, 100);
            await new Promise(r => setTimeout(r, 500)); 

            hideExportOverlay();
            const dateStr = new Date().toISOString().split('T')[0];
            pres.writeFile({ fileName: `StandardAnalysis_Report_${dateStr}.pptx` });
}

export function renderStandardChartToImage(selectedDim) {
    return new Promise((resolve, reject) => {
        // --- CHANGE 1: APPLY ACTIVE RUN FILTER ---
        // We must filter the raw data based on the currently active run selection.
        // If 'run' is null/empty, we handle it as 'No Run'.
        let dimData = globalData.filter(d => 
            d.element === selectedDim && 
            activeRunFilter.has(d.run || "No Run")
        );
        
        if (dimData.length === 0) { 
            console.warn(`No data found for DIM ${selectedDim} respecting active run filters.`);
            reject("No data"); 
            return; 
        }
        
        const rec = dimData[0];
        const adj = adjustments[selectedDim] || 0;
        const unit = document.getElementById('unitSelect').value;
        
        // This naturally includes ALL series (cavities) for the SELECTED runs
        const seriesList = [...new Set(dimData.map(d => getSeriesLabel(d)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        const plotTraces = [];
        let allY = [];
        
        const chartRef = getChartRefColors(true);
        const seriesPalette = getChartSeriesPalette(true);

        seriesList.forEach((series, idx) => {
            const seriesData = dimData.filter(d => getSeriesLabel(d) === series).sort((a,b) => a.sample - b.sample);
            const values = seriesData.map(d => d.value + adj);
            allY = allY.concat(values);
            
            plotTraces.push({ 
                x: seriesData.map(p => p.sample), 
                y: values, 
                mode: 'lines+markers', 
                name: series, 
                line: { color: seriesPalette[idx % seriesPalette.length], width: 2 }, 
                marker: { color: seriesPalette[idx % seriesPalette.length], size: 6 } 
            });
        });

        allY.push(rec.usl, rec.lsl);
        const MathRange = Math.max(...allY) - Math.min(...allY);

        const layout = {
            width: 1215, height: 460, margin: { t: 60, r: 220, l: 80, b: 50 }, 
            title: { text: `<b>${getFullDimensionName(rec)}</b>`, font: { size: 14, color: '#0f172a' }, y: 0.95 },
            
            // --- CHANGE 2: RETAIN WHOLE NUMBER X-AXIS ---
            // We lock the X-axis ticks to linear, integer steps.
            xaxis: { 
                title: 'Sample Sequence', 
                gridcolor: '#e5e7eb', 
                color: '#1e293b',
                tickmode: 'linear',
                dtick: 1 
            },
            
            yaxis: { title: `Measured Value ${unit ? '('+unit+')' : ''}`, automargin: true, gridcolor: '#e5e7eb', color: '#1e293b', range: [Math.min(...allY) - (MathRange*0.1), Math.max(...allY) + (MathRange*0.1)] },
            plot_bgcolor: 'rgba(255,255,255,0)', paper_bgcolor: 'rgba(255,255,255,0)', 
            font: { family: 'Segoe UI, sans-serif', color: '#1e293b' },
            showlegend: true, 
            legend: { orientation: "v", x: 1.02, y: 1, xanchor: "left", yanchor: "top", bgcolor: '#f8fafc', bordercolor: '#e5e7eb', borderwidth: 1, font: { size: 11, color: '#1e293b' } },
            shapes: [
                { type: 'line', y0: rec.usl, y1: rec.usl, x0: 0, x1: 1, xref: 'paper', line: { color: chartRef.limit, width: 2, dash: 'dash' } },
                { type: 'line', y0: rec.lsl, y1: rec.lsl, x0: 0, x1: 1, xref: 'paper', line: { color: chartRef.limit, width: 2, dash: 'dash' } },
                { type: 'line', y0: rec.nominal, y1: rec.nominal, x0: 0, x1: 1, xref: 'paper', line: { color: chartRef.nominal, width: 2 } }
            ]
        };

        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        Plotly.newPlot(tempDiv, plotTraces, layout)
            .then(() => {
                return Plotly.toImage(tempDiv, { format: 'png', width: 1215, height: 460 }); 
            })
            .then((b64Image) => {
                Plotly.purge(tempDiv);
                document.body.removeChild(tempDiv);
                resolve(b64Image); 
            })
            .catch((err) => {
                if (document.body.contains(tempDiv)) {
                    Plotly.purge(tempDiv);
                    document.body.removeChild(tempDiv);
                }
                reject(err);
            });
    });
}

export function showExportOverlay() {
    if(document.getElementById('exportOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'exportOverlay';
    overlay.className = 'fixed inset-0 bg-slate-950/95 z-[9999] flex flex-col items-center justify-center p-10 text-white backdrop-blur-sm';
    overlay.innerHTML = `
        <div class="animate-spin text-5xl text-blue-500 mb-6"><i class="fa-solid fa-spinner"></i></div>
        <div class="text-2xl font-bold mb-2">Generating Automated PowerPoint Report</div>
        <div id="exportStatusText" class="text-slate-400 font-mono text-sm mb-6">Preparing to process dimensions...</div>
        
        <div class="w-full max-w-lg bg-slate-800 rounded-full h-4 mb-4 border border-slate-700 overflow-hidden shadow-inner relative">
            <div id="exportProgressBar" class="bg-blue-500 h-4 rounded-full transition-all duration-200 ease-out relative overflow-hidden" style="width: 0%">
                <div class="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
            </div>
        </div>
        
        <div class="text-xs text-red-400 mt-2">Browser may appear unresponsive during heavy rendering. Do not close this tab.</div>
    `;
    document.body.appendChild(overlay);
}

export function updateExportStatusText(text, percent) {
    const textEl = document.getElementById('exportStatusText');
    const barEl = document.getElementById('exportProgressBar');
    if(textEl) textEl.textContent = text;
    if(barEl && percent !== undefined) {
        const cleanPercent = Math.min(Math.max(percent, 0), 100);
        barEl.style.width = `${cleanPercent}%`;
    }
}

export function hideExportOverlay() {
    const overlay = document.getElementById('exportOverlay');
    if(overlay) document.body.removeChild(overlay);
}
