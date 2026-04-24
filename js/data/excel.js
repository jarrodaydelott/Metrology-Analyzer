/* global ExcelJS, XLSX */

import {
  globalData,
  adjustments,
  ignoredIds,
  dimensionImages,
  rawWorkbookBuffer,
  projectFileName,
} from "../state.js";
import { deferred } from "../app-delegates.js";

// --- NEW: Helper to shrink drawings so they fit in Excel cells (<32k chars) ---
export function compressForExcel(base64Str) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Shrink to a small thumbnail size for storage
            const MAX_WIDTH = 400;
            const scale = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scale;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Export as low-quality JPEG to keep character count very low (~10-15k)
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = base64Str;
    });
}
// ==========================================
// 2. TEMPLATE GENERATION
// ==========================================
export function updateRunNameInputs() {
    const num = parseInt(document.getElementById('inputNumRuns').value) || 1;
    const container = document.getElementById('runNamesContainer');
    const existingInputs = document.querySelectorAll('.run-name-input');
    const values = Array.from(existingInputs).map(i => i.value);
    container.innerHTML = '';
    for(let i = 0; i < num; i++) {
        const val = values[i] || `Run${i+1}`;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'run-name-input w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white focus:border-blue-500 outline-none';
        input.placeholder = `Run ${i+1} Name`;
        input.value = val;
        container.appendChild(input);
    }
}

export async function generateTemplate() {
    const dims = parseInt(document.getElementById('inputDims').value) || 5;
    const numCavs = parseInt(document.getElementById('inputCavs').value) || 4;
    const startCav = parseInt(document.getElementById('inputStartCav').value) || 1; 
    const samples = parseInt(document.getElementById('inputSamples').value) || 30;
    const runInputs = document.querySelectorAll('.run-name-input');
    const runNames = Array.from(runInputs).map(input => input.value.trim() || "Run");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Input Data');

    const headerRow = ["Item", "Type", "Description", "Nominal", "Tol +", "Tol -"];
    let currentCol = 7; 
    const cavityRanges = [];

    runNames.forEach(runName => {
        for (let i = 0; i < numCavs; i++) {
            const currentCavityNum = startCav + i;
            const start = currentCol;
            for (let s = 1; s <= samples; s++) {
                headerRow.push(`Cav ${currentCavityNum}_Sam ${s}_Run ${runName}`);
                currentCol++;
            }
            cavityRanges.push({ c: currentCavityNum, start, end: currentCol - 1 }); 
        }
    });

    worksheet.addRow(headerRow);

    for (let d = 1; d <= dims; d++) {
        const itemVal = (d % 3 === 0) ? "63.20" : d.toString(); 
        const typeVal = (d % 2 === 0 ? "Critical" : "FAI");
        const rowValues = [itemVal, typeVal, "Feature_Desc", 10.0, 0.1, 0.1];
        const row = worksheet.addRow(rowValues);
        
        row.getCell(2).dataValidation = {
            type: 'list', allowBlank: false, formulae: ['"FAI,Critical,Basic,Ref"'],
            showErrorMessage: true, errorTitle: 'Invalid', error: 'Select FAI, Critical, Basic, or Ref'
        };
    }

    cavityRanges.forEach((range) => {
        if (range.c % 2 === 0) {
            for (let colIdx = range.start; colIdx <= range.end; colIdx++) {
                worksheet.getColumn(colIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            }
        }
    });

    const headerRowObj = worksheet.getRow(1);
    headerRowObj.height = 20;
    for (let i = 1; i <= headerRow.length; i++) {
        const cell = headerRowObj.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        cell.font = { name: 'Segoe UI', color: { argb: 'FFFFFFFF' }, bold: true };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } }, right: { style: 'thin', color: { argb: 'FF334155' } } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    worksheet.views = [{ state: 'frozen', xSplit: 6, ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Metrology_Template_${runNames.length}Runs.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
}

// ==========================================
// 3. FILE PARSING
// ==========================================
export function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    projectFileName = file.name;
    
    const display = document.getElementById('currentFileDisplay');
    const text = document.getElementById('currentFileName');
    
    // Safely update the filename text
    if (text) {
        text.textContent = projectFileName; 
    }
    
    // Safely toggle visibility ONLY if the old display container still exists
    if (display) {
        if(projectFileName) { 
            display.classList.remove('hidden'); 
        } else { 
            display.classList.add('hidden'); 
        }
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        rawWorkbookBuffer = new Uint8Array(e.target.result); 
        const workbook = XLSX.read(rawWorkbookBuffer, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
        processData(rawData);
    };
    reader.readAsArrayBuffer(file);
}

export function processData(rows) {
    if (!rows || rows.length < 2) { 
        alert("File appears empty or invalid."); 
        return; 
    }

    const parsedData = [];
    let currentDataCols = [];
    
    // Standardize variable name to match the rest of the app
    dimensionImages = {}; 
    
    let itemIdx = -1, typeIdx = -1, descIdx = -1, nominalIdx = -1, tolMinIdx = -1, tolMaxIdx = -1, imgColIdx = -1;
    const measRegex = /Cav(?:ity)?\s*[_.]?\s*(\d+).*?Sam(?:ple)?\s*[_.]?\s*(\d+)(?:.*Run\s*[_.]?\s*(.*))?/i;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const hasNominal = row.some(cell => /Nominal/i.test(String(cell)));
        const hasCavityCol = row.some(cell => measRegex.test(String(cell)));

        if (hasNominal && hasCavityCol) {
            currentDataCols = [];
            itemIdx = row.findIndex(h => h && (/Item/i.test(String(h)) || /Element/i.test(String(h))));
            if (itemIdx === -1) itemIdx = 0;

            typeIdx = row.findIndex(h => h && /Type/i.test(String(h)));
            descIdx = row.findIndex(h => h && (/Description/i.test(String(h)) || /Feature/i.test(String(h))));
            nominalIdx = row.findIndex(h => h && /Nominal/i.test(String(h)));
            tolMinIdx = row.findIndex(h => h && /Tol\s*[-]/i.test(String(h)));
            tolMaxIdx = row.findIndex(h => h && /Tol\s*[+]/i.test(String(h)));
            
            // Search specifically for "Drawing Data"
            imgColIdx = row.findIndex(h => h && /Drawing Data/i.test(String(h)));

            row.forEach((cell, index) => {
                if (!cell) return;
                const match = String(cell).trim().match(measRegex);
                if (match) {
                    currentDataCols.push({ 
                        index: index, 
                        cavity: parseInt(match[1]), 
                        sample: parseInt(match[2]), 
                        run: match[3] ? match[3].trim() : "Run1" 
                    });
                }
            });
            continue; 
        }

        if (currentDataCols.length > 0) {
            const itemRaw = row[itemIdx];
            if (!itemRaw || /Nominal/i.test(String(itemRaw))) continue;
            const itemStr = String(itemRaw).trim(); 

            // Extract drawing string from Excel if it exists
            if (imgColIdx >= 0 && row[imgColIdx]) {
                const imgData = String(row[imgColIdx]).trim();
                if (imgData.startsWith('data:image')) {
                    dimensionImages[itemStr] = imgData;
                }
            }

            currentDataCols.forEach(col => {
                const val = row[col.index];
                if (val !== undefined && val !== null && val !== "") {
                    const numVal = parseFloat(val);
                    if (!isNaN(numVal)) {
                        const nominal = parseFloat(row[nominalIdx]) || 0;
                        const tPlus = parseFloat(row[tolMaxIdx]) || 0;
                        const tMinus = parseFloat(row[tolMinIdx]) || 0;

                        parsedData.push({
                            _id: 'id-' + Math.random().toString(36).substr(2, 9),
                            element: itemStr,
                            description: row[typeIdx] || "Basic", 
                            feature: row[descIdx] || "",
                            nominal: nominal,
                            usl: nominal + tPlus,
                            lsl: nominal - tMinus,
                            value: numVal,
                            cavity: col.cavity,
                            sample: col.sample,
                            run: col.run
                        });
                    }
                }
            });
        }
    }

    if (parsedData.length === 0) { 
        alert("No valid data found."); 
        return; 
    }

    globalData = parsedData;
    adjustments = {}; 
    ignoredIds = new Set();
    deferred.triggerAfterExcelUpload();
}
// ==========================================
// EXCEL IMAGE INJECTION LOGIC (Fix: After Tol -)
// ==========================================

export async function finishWizard() {
    try {
        // 1. Run the Excel Injection
        await injectDrawingsToExcel();
        
        // 2. Close the modal
        deferred.closePdfWizard();

        // 3. Refresh the Dashboard to show captured images
        deferred.updateDashboard?.();
        deferred.updateSixPack?.();

        alert("Success! Drawings are now embedded in the downloaded Excel file.");
    } catch (err) {
        console.error("Save Error:", err);
        alert("Failed to save drawings: " + err.message);
    }
}

export async function injectDrawingsToExcel() {
    if (!rawWorkbookBuffer) {
        alert("No source Excel file loaded.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(rawWorkbookBuffer);
    const worksheet = workbook.worksheets[0];

    // Find Header Indices
    let headerRow = worksheet.getRow(1);
    let itemColIdx = -1, tolMinusColIdx = -1, drawingDataColIdx = -1;

    headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value);
        if (/Item/i.test(val) || /Element/i.test(val)) itemColIdx = colNumber;
        if (/Tol\s*[-]/i.test(val)) tolMinusColIdx = colNumber;
        if (/Drawing Data/i.test(val)) drawingDataColIdx = colNumber;
    });

    if (itemColIdx === -1 || tolMinusColIdx === -1) {
        alert("Could not find required columns.");
        return;
    }

    // Ensure 'Drawing Data' column exists after 'Tol -'
    if (drawingDataColIdx === -1) {
        drawingDataColIdx = tolMinusColIdx + 1;
        worksheet.spliceColumns(drawingDataColIdx, 0, []);
        const headerCell = worksheet.getRow(1).getCell(drawingDataColIdx);
        headerCell.value = "Drawing Data";
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        headerCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }

    // Inject COMPRESSED Strings
    const rowCount = worksheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
        const row = worksheet.getRow(i);
        const itemVal = String(row.getCell(itemColIdx).value).trim();
        
        if (dimensionImages[itemVal]) {
            // Compress on the fly so it stays under the 32,767 char limit
            const tinyStr = await compressForExcel(dimensionImages[itemVal]);
            row.getCell(drawingDataColIdx).value = tinyStr;
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = projectFileName.replace(".xlsx", "_Master_Project.xlsx");
    link.click();
    rawWorkbookBuffer = buffer;
}
