import { globalData } from "../state.js";

/** Pulse the Data file picker when no Excel file has been loaded yet. */
export function updateFileUploadPulse() {
    const input = document.getElementById("fileUpload");
    if (!input) return;
    input.classList.toggle("file-upload-prompt", globalData.length === 0);
}
