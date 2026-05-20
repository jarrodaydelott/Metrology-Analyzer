/** Resolve chart id when capability stats bulb mirrors spChart6 insights. */
function resolveInsightChartId(chartId) {
  const insights = window.currentInsights || {};
  if (insights[chartId]) return chartId;
  if (chartId === "spStats" && insights.spChart6) return "spChart6";
  return chartId;
}

export function showInsight(chartId) {
  try {
    const resolvedId = resolveInsightChartId(chartId);
    const insight = window.currentInsights?.[resolvedId];

    if (!insight) {
      if (chartId === "spStats" && typeof globalThis.showChartHelp === "function") {
        globalThis.showChartHelp("cap");
        return;
      }
      console.warn("No insight mapped for:", chartId, resolvedId !== chartId ? `(resolved: ${resolvedId})` : "");
      return;
    }

    const sidebar = document.getElementById("ai-helper-sidebar");
    const content = document.getElementById("ai-content-area");
    if (!sidebar || !content) return;

    const safeTips = Array.isArray(insight.tips) ? insight.tips : [];

    content.innerHTML = `
            <div class="ai-helper-content">
                <h3 class="text-white border-b border-slate-700 pb-2 mb-4">
                    <i class="fa-solid fa-lightbulb text-blue-400 mr-2"></i>Expert Help
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
                        ${safeTips.map((tip) => `<li>${tip}</li>`).join("")}
                    </ul>
                </div>
            </div>
        `;

    sidebar.classList.add("open");
  } catch (err) {
    console.error("Error opening insight sidebar:", err);
  }
}

let sixPackInsightBound = false;

/** Delegated clicks so module load order cannot break inline onclick handlers. */
export function bindSixPackInsightButtons() {
  if (sixPackInsightBound) return;
  const view = document.getElementById("viewSixPack");
  if (!view) return;
  sixPackInsightBound = true;
  view.addEventListener("click", (e) => {
    const btn = e.target.closest(".chart-insight-btn.pulsing-bulb");
    if (!btn || btn.classList.contains("hidden")) return;
    const chartId = btn.id?.startsWith("bulb-") ? btn.id.slice(5) : null;
    if (!chartId) return;
    e.preventDefault();
    e.stopPropagation();
    showInsight(chartId);
  });
}
