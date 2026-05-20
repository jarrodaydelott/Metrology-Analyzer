import { dimensionImages } from "../state.js";

// ==========================================
// VIEW-SPECIFIC DRAWING IMAGE LOGIC
// ==========================================

export function updateDrawingPopupImage(page = "std") {
    const selectorId = (page === 'sixpack' || page === 'sp') ? 'spDimSelect' : 'dimSelect';
    const dim = document.getElementById(selectorId)?.value;
    if (!dim) return;

    if (page === 'std') {
        const imgEl = document.getElementById('inline-drawing-image-std');
        if (dimensionImages[dim] && imgEl) {
            imgEl.src = dimensionImages[dim];
        }
    } else if (page === 'sp' || page === 'sixpack') {
        // Look for the new unique IDs we just created
        const imgEl = document.getElementById('sp-static-drawing-img');
        const placeholder = document.getElementById('sp-static-placeholder');
        
        if (dimensionImages[dim]) {
            // Show Image, Hide Placeholder
            if (imgEl) { imgEl.src = dimensionImages[dim]; imgEl.classList.remove('hidden'); }
            if (placeholder) placeholder.classList.add('hidden');
        } else {
            // Hide Image, Show Placeholder
            if (imgEl) imgEl.classList.add('hidden');
            if (placeholder) placeholder.classList.remove('hidden');
        }
    }
}

export function toggleSpDrawingPanel() {
    const body = document.getElementById("sp-drawing-body");
    const icon = document.getElementById("sp-drawing-toggle-icon");
    if (!body) return;
    body.classList.toggle("hidden");
    body.classList.toggle("flex");
    if (icon) {
        icon.classList.toggle("fa-chevron-down", body.classList.contains("hidden"));
        icon.classList.toggle("fa-chevron-up", !body.classList.contains("hidden"));
    }
}

export function updateDrawingButtonVisibility() {
    const dimStd = document.getElementById('dimSelect')?.value;
    const containerStd = document.getElementById('inline-drawing-container-std');

    // --- STANDARD VIEW LOGIC (Always-On Image) ---
    if (containerStd && dimStd) {
        if (dimensionImages[dimStd]) {
            containerStd.classList.remove('hidden');
            updateDrawingPopupImage('std');
        } else {
            containerStd.classList.add('hidden');
        }
    }

    // --- SIX PACK VIEW LOGIC (Static Card Update) ---
    updateDrawingPopupImage('sp');
}
