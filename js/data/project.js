import {
  globalData,
  adjustments,
  ignoredIds,
  dimensionImages,
  currentFileHandle,
} from "../state.js";
import { deferred } from "../app-delegates.js";

export async function saveProject(isSaveAs = false) {
  if (globalData.length === 0) {
    alert("No data to save.");
    return;
  }
  const payload = {
    data: globalData,
    adjustments,
    ignoredIds: Array.from(ignoredIds),
    unit: document.getElementById("unitSelect").value,
    targetCpk: document.getElementById("targetCpkInput").value,
    dimensionImages,
    timestamp: new Date().toISOString(),
  };
  const jsonString = JSON.stringify(payload, null, 2);
  const fileName = `Metrology_Project_${new Date().toISOString().slice(0, 10)}.json`;

  let useFallback = true;
  if (window.showSaveFilePicker) {
    try {
      if (!isSaveAs && currentFileHandle) {
        const writable = await currentFileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        useFallback = false;
        alert("Project saved.");
      } else {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "JSON Project File", accept: { "application/json": [".json"] } }],
        });
        currentFileHandle = handle;
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        useFallback = false;
      }
    } catch (err) {
      if (err.name === "AbortError") useFallback = false;
    }
  }
  if (useFallback) {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

export function handleLoadProject(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      const payload = JSON.parse(ev.target.result);
      if (!payload.data) throw new Error("Invalid project file");
      globalData.length = 0;
      globalData.push(...payload.data);
      Object.keys(adjustments).forEach((k) => delete adjustments[k]);
      Object.assign(adjustments, payload.adjustments || {});
      ignoredIds.clear();
      (payload.ignoredIds || []).forEach((id) => ignoredIds.add(id));
      Object.keys(dimensionImages).forEach((k) => delete dimensionImages[k]);
      Object.assign(dimensionImages, payload.dimensionImages || {});
      if (payload.unit) document.getElementById("unitSelect").value = payload.unit;
      if (payload.targetCpk) document.getElementById("targetCpkInput").value = payload.targetCpk;

      deferred.initUI();

      const dim = document.getElementById("dimSelect").value;
      const spDim = document.getElementById("spDimSelect").value;
      if (dim) document.getElementById("steelAdjStd").value = (adjustments[dim] || 0).toFixed(3);
      if (spDim) document.getElementById("steelAdjSp").value = (adjustments[spDim] || 0).toFixed(3);

      alert("Project loaded successfully!");
      deferred.showMainApp();
    } catch (err) {
      alert("Error loading project: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}
