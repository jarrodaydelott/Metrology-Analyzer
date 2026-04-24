import { currentTab, currentAiState, currentOutliers } from "../state.js";
import { AI_INTRO_TEMPLATE, SPC_AI_TEMPLATE } from "../constants.js";

export function openAiHelper() {
    const sidebar = document.getElementById('ai-helper-sidebar');
    const content = document.getElementById('ai-content-area');
    if (!sidebar || !content) return;
    
    if (currentTab === 'spc') {
        content.innerHTML = SPC_AI_TEMPLATE;
    } else {
        content.innerHTML = AI_INTRO_TEMPLATE;
        if (currentAiState.isMixedCavity) document.getElementById('tip-cavity-mixing')?.classList.add('highlight-tip');
        if (currentAiState.hasTrend) document.getElementById('tip-process-drift')?.classList.add('highlight-tip');
        if (currentAiState.isBoundary) document.getElementById('tip-boundary')?.classList.add('highlight-tip');
        if (currentAiState.isLowRes) document.getElementById('tip-resolution')?.classList.add('highlight-tip');
        if (currentOutliers.length > 0) document.getElementById('tip-outliers')?.classList.add('highlight-tip');
    }
    sidebar.classList.add('open');
}

export function closeAiHelper() {
    const sidebar = document.getElementById('ai-helper-sidebar');
    if (sidebar) sidebar.classList.remove('open');
}
