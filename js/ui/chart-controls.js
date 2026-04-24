/* global Plotly */

import { chartExplanations } from "../constants.js";

export function showChartHelp(key) {
    const info = chartExplanations[key];
    if(!info) return;
    const modal = document.getElementById('graph-help-modal');
    document.getElementById('modal-title').innerHTML = info.title;
    document.getElementById('modal-content').innerHTML = info.content;
    modal.classList.remove('hidden');
}

export function toggleChartFullscreen(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.classList.toggle('chart-fullscreen');
    const btnIcon = el.querySelector('.chart-expand-btn i');
    if (el.classList.contains('chart-fullscreen')) {
        btnIcon.classList.remove('fa-expand');
        btnIcon.classList.add('fa-compress');
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === "Escape") {
                toggleChartFullscreen(containerId);
                document.removeEventListener('keydown', escHandler);
            }
        });
    } else {
        btnIcon.classList.remove('fa-compress');
        btnIcon.classList.add('fa-expand');
    }
    const plotDiv = el.querySelector('div[id^="spChart"]');
    if (plotDiv) {
        setTimeout(() => { Plotly.Plots.resize(plotDiv.id); }, 50);
    }
}
