/**
 * Six-Pack expandable cards (normality + capability method).
 * Collapsed by default; summary stays in the header.
 */

const COLLAPSIBLE_IDS = ["spNormalityTest", "spCapabilityMethod"];

export function toggleSpCollapsible(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const body = panel.querySelector(".sp-collapsible-body");
  const toggle = panel.querySelector(".sp-collapsible-toggle");
  if (!body) return;

  const expand = body.classList.contains("hidden");
  body.classList.toggle("hidden", !expand);
  panel.classList.toggle("is-expanded", expand);
  if (toggle) toggle.setAttribute("aria-expanded", expand ? "true" : "false");
}

export function collapseSpPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const body = panel.querySelector(".sp-collapsible-body");
  const toggle = panel.querySelector(".sp-collapsible-toggle");
  if (body) body.classList.add("hidden");
  panel.classList.remove("is-expanded");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

export function initSpCollapsiblePanels() {
  COLLAPSIBLE_IDS.forEach(collapseSpPanel);
}
