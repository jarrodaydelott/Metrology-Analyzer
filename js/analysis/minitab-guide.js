/* global jStat */

import { METHOD_IDS, AD_TRANSFORM_MIN_P } from "./capability-methods.js";
import { calculateSkewness } from "../math/stats.js";

/** Badge / emphasis classes aligned with stats-panel P-value severity. */
export function getNormalityPSeverity(p) {
  if (p == null || Number.isNaN(p)) {
    return { badgeClass: "text-amber-400 border border-amber-500/50", label: "NON-NORMAL" };
  }
  if (p < 0.001) {
    return {
      badgeClass: "text-red-400 border border-red-500 bg-red-500/10",
      label: "NON-NORMAL",
    };
  }
  if (p < 0.05) {
    return {
      badgeClass: "text-accent-danger border border-red-500/60 bg-red-500/5",
      label: "NON-NORMAL",
    };
  }
  return { badgeClass: "text-accent-success border border-emerald-500/50", label: "NORMAL" };
}

function formatP(p) {
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}

function inferShapeReason(analysis, values, mean, std) {
  const { isMultimodal, hasTrend, isBoundary, featureName } = analysis;
  if (isMultimodal) return "multi-cavity / mixed populations combined";
  if (hasTrend) return "process drift over the sampling window";
  if (isBoundary) return "zero-bounded GD&T (physical lower limit)";
  const skew = calculateSkewness(values, mean, std);
  if (Math.abs(skew) > 1) return skew > 0 ? "heavy right skew" : "heavy left skew";
  return "non-bell-curve shape on raw data";
}

function pickPath(options, adStats) {
  const rec =
    options?.find((o) => o.recommended && o.applicable !== false) ||
    options?.find((o) => o.applicable !== false);
  const box = options?.find((o) => o.id === METHOD_IDS.BOXCOX);
  const johnson = options?.find((o) => o.id === METHOD_IDS.JOHNSON);
  const pct = options?.find((o) => o.id === METHOD_IDS.PERCENTILE);
  const taylor = options?.find((o) => o.id === METHOD_IDS.TAYLOR);

  if (adStats.p >= 0.05) {
    return {
      analysisType: "Normal Capability Analysis",
      menuRoute: "Stat > Quality Tools > Capability Analysis > Normal",
      transformation: "None (data pass Anderson–Darling)",
      distribution: "Normal",
      reasoning: `Raw data pass Anderson–Darling (P = ${formatP(adStats.p)}). Use standard parametric Pp/Ppk in Minitab.`,
    };
  }

  if (johnson?.applicable && johnson.adP >= AD_TRANSFORM_MIN_P) {
    const beatsBox =
      !box?.applicable || !box.adP || johnson.adP >= (box.adP ?? 0);
    if (rec?.id === METHOD_IDS.JOHNSON || beatsBox) {
      return {
        analysisType: "Nonnormal Capability Analysis",
        menuRoute: "Stat > Quality Tools > Capability Analysis > Nonnormal",
        transformation: "Johnson Transformation",
        distribution: johnson.detail?.split(";")[0] || "Johnson system (Sb / Sl / Su)",
        reasoning: `Raw data fails AD (P = ${formatP(adStats.p)}) but passes under Johnson (transformed AD P = ${formatP(johnson.adP)} ≥ ${AD_TRANSFORM_MIN_P.toFixed(2)}).`,
        transformedAdP: johnson.adP,
      };
    }
  }

  if (box?.applicable && box.adP >= AD_TRANSFORM_MIN_P) {
    return {
      analysisType: "Nonnormal Capability Analysis",
      menuRoute: "Stat > Quality Tools > Capability Analysis > Nonnormal",
      transformation: "Box-Cox Transformation",
      distribution: "After Box-Cox — evaluate transformed normality in IDI",
      reasoning: `Raw data fails AD (P = ${formatP(adStats.p)}) but passes under Box-Cox (transformed AD P = ${formatP(box.adP)} ≥ ${AD_TRANSFORM_MIN_P.toFixed(2)}). All values must be > 0.`,
      transformedAdP: box.adP,
    };
  }

  if (taylor?.applicable) {
    return {
      analysisType: "Normal Capability Analysis (with STAT-18 waiver)",
      menuRoute: "Stat > Quality Tools > Capability Analysis > Normal",
      transformation: "None — document Taylor STAT-18 Appendix I criteria in report",
      distribution: "Normal (normality test waived when Ppk is very high)",
      reasoning: `AD fails (P = ${formatP(adStats.p)}) but Taylor high-capability criteria are met — parametric Ppk may still be defensible for variables sampling.`,
    };
  }

  if (pct?.applicable) {
    return {
      analysisType: "Nonnormal Capability Analysis",
      menuRoute: "Stat > Quality Tools > Capability Analysis > Nonnormal",
      transformation: "None — use nonparametric / percentile capability",
      distribution: "Nonparametric (empirical percentiles)",
      reasoning: `Transforms do not reach AD P ≥ ${AD_TRANSFORM_MIN_P.toFixed(2)}. Use Minitab nonparametric capability (0.135th / 99.865th percentiles) for lot acceptance.`,
    };
  }

  return {
    analysisType: "Nonnormal Capability Analysis",
    menuRoute: "Stat > Quality Tools > Capability Analysis > Nonnormal",
    transformation: "Try Johnson, then Box-Cox (if all values > 0), else nonparametric",
    distribution: "Select best fit in Individual Distribution Identification",
    reasoning: `Raw Anderson–Darling P = ${formatP(adStats.p)}. Screen transforms in IDI; prefer path with AD P ≥ ${AD_TRANSFORM_MIN_P.toFixed(2)}.`,
  };
}

/**
 * @returns {{ html: string, path: object } | null}
 */
export function buildMinitabPathForward(ctx) {
  const { adStats, options, analysis, values } = ctx;
  if (!adStats || adStats.p == null) return null;

  const mean = values?.length ? jStat.mean(values) : 0;
  const std = values?.length ? jStat.stdev(values, true) : 0;
  const shapeHint = inferShapeReason(analysis, values || [], mean, std);
  const path = pickPath(options, adStats);

  let reasoning = path.reasoning;
  if (adStats.p < 0.05 && !reasoning.includes(shapeHint)) {
    reasoning += ` Likely driver: ${shapeHint}.`;
  } else if (adStats.p < 0.05 && analysis?.isMultimodal) {
    reasoning = reasoning.replace(/\.$/, "") + ` due to ${shapeHint}.`;
  }

  const rows = [
    ["Analysis Type", path.analysisType],
    ["Menu Route", `<code class="text-[11px] bg-slate-900/80 px-1.5 py-0.5 rounded">${path.menuRoute}</code>`],
    ["Transformation", path.transformation],
    ["Distribution", path.distribution],
    ["Reasoning", reasoning],
  ];

  const html = `<dl class="minitab-guide-kv grid grid-cols-1 sm:grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-2 text-xs">
    ${rows
      .map(
        ([k, v]) =>
          `<dt class="font-bold text-slate-300">${k}</dt><dd class="text-slate-400 min-w-0">${v}</dd>`,
      )
      .join("")}
  </dl>`;

  return { html, path };
}

export function renderMinitabGuidePanel(guide) {
  const panel = document.getElementById("spMinitabGuide");
  const body = document.getElementById("spMinitabGuideBody");
  if (!panel || !body) return;
  if (!guide) {
    panel.classList.add("hidden");
    body.innerHTML = "";
    return;
  }
  body.innerHTML = guide.html;
  panel.classList.remove("hidden");
}
