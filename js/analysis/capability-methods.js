/* global jStat */

import {
  calculateAndersonDarling,
  calculateSkewness,
  getQuantile,
} from "../math/stats.js";
import { fitBoxCox, fitJohnson } from "../math/transforms.js";

export const METHOD_IDS = {
  PARAMETRIC: "parametric",
  PERCENTILE: "percentile",
  BOXCOX: "boxcox",
  JOHNSON: "johnson",
  TAYLOR: "taylor_high_capability",
};

/** Minitab Individual Distribution Identification: prefer transform when AD P ≥ 0.10 */
export const AD_TRANSFORM_MIN_P = 0.1;

function multimodalBlock() {
  return "Filter to a single cavity before using this method.";
}

function transformNormalityBlock(adP) {
  return `Normality not achieved (transformed AD P = ${adP.toFixed(3)}; need ≥ ${AD_TRANSFORM_MIN_P.toFixed(2)} per Minitab IDI).`;
}

/** STAT-18 Appendix I multipliers (95% confidence, two-sided Ppk); linear interpolation on n. */
const TAYLOR_N = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 120, 150, 200];
const TAYLOR_MULT = [2.55, 2.35, 2.18, 2.05, 1.96, 1.9, 1.87, 1.84, 1.75, 1.68, 1.62, 1.57, 1.53, 1.45, 1.38, 1.3];

export function getTaylorMultiplier(n) {
  const nn = Math.max(15, Math.min(200, n));
  if (nn <= TAYLOR_N[0]) return TAYLOR_MULT[0];
  if (nn >= TAYLOR_N[TAYLOR_N.length - 1]) return TAYLOR_MULT[TAYLOR_MULT.length - 1];
  for (let i = 0; i < TAYLOR_N.length - 1; i++) {
    if (nn >= TAYLOR_N[i] && nn <= TAYLOR_N[i + 1]) {
      const t = (nn - TAYLOR_N[i]) / (TAYLOR_N[i + 1] - TAYLOR_N[i]);
      return TAYLOR_MULT[i] + t * (TAYLOR_MULT[i + 1] - TAYLOR_MULT[i]);
    }
  }
  return TAYLOR_MULT[TAYLOR_MULT.length - 1];
}

export function evaluateTaylorHighCapability(values, Ppk_Norm, targetCpk) {
  const n = values.length;
  const mean = jStat.mean(values);
  const std = jStat.stdev(values, true);
  const skew = calculateSkewness(values, mean, std);
  const mult = getTaylorMultiplier(n);
  const requiredPpk = mult * targetCpk;
  const met = Ppk_Norm >= requiredPpk && skew > -2 && skew <= 2;
  return { met, mult, requiredPpk, skew, Ppk_Norm };
}

function computePercentilePpPpk(values, lsl, usl) {
  const median = jStat.median(values);
  const p99865 = getQuantile(values, 0.99865);
  const p00135 = getQuantile(values, 0.00135);
  if (p99865 <= p00135) return null;
  const Pp = (usl - lsl) / (p99865 - p00135);
  const PpkU = (usl - median) / (p99865 - median);
  const PpkL = (median - lsl) / (median - p00135);
  const Ppk = Math.min(PpkU, PpkL);
  return { Pp, Ppk };
}

function computeParametricPpPpk(values, lsl, usl) {
  const mean = jStat.mean(values);
  const std = jStat.stdev(values, true);
  if (std <= 0) return { Pp: 0, Ppk: 0, mean, std };
  const Pp = (usl - lsl) / (6 * std);
  const PpkU = (usl - mean) / (3 * std);
  const PpkL = (mean - lsl) / (3 * std);
  const Ppk = Math.min(PpkU, PpkL);
  return { Pp, Ppk, mean, std };
}

const METHOD_META = {
  [METHOD_IDS.PARAMETRIC]: {
    id: METHOD_IDS.PARAMETRIC,
    title: "Parametric (σ-based)",
    short: "Standard Pp/Ppk using overall standard deviation. Assumes normality.",
    helpKey: "cap_parametric",
  },
  [METHOD_IDS.PERCENTILE]: {
    id: METHOD_IDS.PERCENTILE,
    title: "Non-Parametric (Percentile)",
    short: "Uses 0.135th / 99.865th percentiles — Minitab nonparametric path; no bell-curve assumption.",
    helpKey: "cap_percentile",
  },
  [METHOD_IDS.BOXCOX]: {
    id: METHOD_IDS.BOXCOX,
    title: "Box-Cox Transform",
    short: "Power transform for positive data; capability on transformed scale (Minitab IDI).",
    helpKey: "cap_boxcox",
  },
  [METHOD_IDS.JOHNSON]: {
    id: METHOD_IDS.JOHNSON,
    title: "Johnson Transform",
    short: "Sb / Sl / Su system for skewed, bounded, or mixed-sign data (Minitab IDI).",
    helpKey: "cap_johnson",
  },
  [METHOD_IDS.TAYLOR]: {
    id: METHOD_IDS.TAYLOR,
    title: "Taylor High Capability (STAT-18)",
    short: "Parametric Ppk with normality waiver when capability is very high and skew is acceptable.",
    helpKey: "cap_taylor",
  },
};

/**
 * @param {object} ctx
 * @returns {{ options: object[], fits: { boxcox?: object, johnson?: object }, taylor: object }}
 */
export function evaluateCapabilityOptions(ctx) {
  const {
    values,
    lsl,
    usl,
    adStats,
    Ppk_Norm,
    targetCpk,
    isMultimodal,
    hasTrend,
    isBoundary,
    isLowRes,
    minVal,
  } = ctx;

  const n = values.length;
  const taylor = evaluateTaylorHighCapability(values, Ppk_Norm, targetCpk);
  const allPositive = minVal > 0;
  const hasNonPositive = minVal <= 0;

  let boxcoxFit = null;
  let johnsonFit = null;
  if (!isMultimodal && allPositive) boxcoxFit = fitBoxCox(values);
  if (!isMultimodal) johnsonFit = fitJohnson(values);

  const pct = computePercentilePpPpk(values, lsl, usl);

  const options = [];

  const add = (id, extra = {}) => {
    const base = { ...METHOD_META[id], ...extra };
    options.push(base);
  };

  add(METHOD_IDS.PARAMETRIC, {
    applicable: true,
    recommended: false,
    adP: adStats.p,
    detail: `Raw AD P = ${adStats.p.toFixed(3)}. Indices assume normality.`,
    rank: 50,
  });

  if (pct) {
    let rec = isBoundary && !isMultimodal;
    let rank = rec ? 10 : 20;
    if (isMultimodal) rank = 90;
    add(METHOD_IDS.PERCENTILE, {
      applicable: !isMultimodal,
      blockedReason: isMultimodal ? "Filter to a single cavity before using percentile capability." : null,
      recommended: rec && !hasTrend,
      adP: null,
      detail: "99.73% spread from empirical percentiles (AIAG / Minitab nonparametric).",
      rank,
    });
  }

  if (boxcoxFit?.ok) {
    const transformPasses = boxcoxFit.adStats.p >= AD_TRANSFORM_MIN_P;
    const rec = transformPasses && !isBoundary;
    const applicable = !isMultimodal && !isBoundary && transformPasses;
    add(METHOD_IDS.BOXCOX, {
      applicable,
      blockedReason: isMultimodal
        ? multimodalBlock()
        : isBoundary
          ? "Not valid for zero-bounded GD&T — distorts physical lower bound."
          : !transformPasses
            ? transformNormalityBlock(boxcoxFit.adStats.p)
            : null,
      recommended: rec && !hasTrend,
      adP: boxcoxFit.adStats.p,
      detail: `${boxcoxFit.label}; transformed AD P = ${boxcoxFit.adStats.p.toFixed(3)}`,
      rank: rec ? 15 : 55,
      fit: boxcoxFit,
    });
  } else if (allPositive && !isMultimodal) {
    add(METHOD_IDS.BOXCOX, {
      applicable: false,
      blockedReason: boxcoxFit?.reason || "Box-Cox could not be fitted to this data.",
      recommended: false,
      adP: null,
      detail: "Requires all values > 0.",
      rank: 99,
    });
  } else if (!allPositive) {
    add(METHOD_IDS.BOXCOX, {
      applicable: false,
      blockedReason: "Requires all values > 0 (use Johnson if zeros or negatives are present).",
      recommended: false,
      adP: null,
      detail: "",
      rank: 99,
    });
  }

  if (johnsonFit?.ok) {
    const transformPasses = johnsonFit.adStats.p >= AD_TRANSFORM_MIN_P;
    const rec =
      transformPasses &&
      !isBoundary &&
      (!boxcoxFit?.ok || !boxcoxFit.adStats || boxcoxFit.adStats.p < johnsonFit.adStats.p);
    const applicable = !isMultimodal && transformPasses;
    add(METHOD_IDS.JOHNSON, {
      applicable,
      blockedReason: isMultimodal
        ? multimodalBlock()
        : !transformPasses
          ? transformNormalityBlock(johnsonFit.adStats.p)
          : null,
      recommended: rec && !hasTrend,
      adP: johnsonFit.adStats.p,
      detail: `${johnsonFit.label}; transformed AD P = ${johnsonFit.adStats.p.toFixed(3)}`,
      rank: rec ? 12 : 50,
      fit: johnsonFit,
    });
  } else if (!isMultimodal) {
    add(METHOD_IDS.JOHNSON, {
      applicable: false,
      blockedReason: johnsonFit?.reason || "Johnson transformation could not be fitted.",
      recommended: false,
      adP: null,
      detail: "",
      rank: 99,
    });
  }

  const taylorApplicable = taylor.met && !isMultimodal && !hasTrend;
  const taylorDetail = taylor.met
    ? `Criteria met — Ppk ${Ppk_Norm.toFixed(2)} ≥ ${taylor.requiredPpk.toFixed(2)} (×${taylor.mult.toFixed(2)} for n=${n}), skew ${taylor.skew.toFixed(2)}`
    : `Need Ppk ≥ ${taylor.requiredPpk.toFixed(2)} (currently ${Ppk_Norm.toFixed(2)}) and skew between −2 and 2 (currently ${taylor.skew.toFixed(2)})`;
  add(METHOD_IDS.TAYLOR, {
    applicable: taylorApplicable,
    blockedReason: taylorApplicable
      ? null
      : isMultimodal
        ? multimodalBlock()
        : hasTrend
          ? "Stabilize the process (drift detected) before applying acceptance criteria."
          : "STAT-18 Appendix I high-capability criteria not met.",
    recommended: taylorApplicable,
    adP: adStats.p,
    detail: taylorDetail,
    rank: taylorApplicable ? 18 : 70,
    taylor,
  });

  if (hasTrend) {
    options.forEach((o) => {
      if (o.id !== METHOD_IDS.PARAMETRIC) o.recommended = false;
    });
  }
  if (isLowRes) {
    options.forEach((o) => {
      o.detail = (o.detail || "") + " Note: coarse resolution may cause false AD rejection (STAT-18 ties).";
    });
  }

  options.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.rank - b.rank;
  });

  return { options, fits: { boxcox: boxcoxFit, johnson: johnsonFit }, taylor };
}

/**
 * @returns {{ Pp, Ppk, displayValues, adStats, meta, mean, overallSd }}
 */
export function computeCapabilityIndices(method, ctx) {
  const { values, lsl, usl, Pp_Norm, Ppk_Norm, adStatsRaw, fits, targetCpk } = ctx;
  const rawAd = adStatsRaw;

  const meta = {
    methodId: method,
    methodLabel: METHOD_META[method]?.title || method,
    helpKey: METHOD_META[method]?.helpKey || "cap",
    showReferenceNorm: false,
    Pp_Norm,
    Ppk_Norm,
    rawAdP: rawAd.p,
    isTransformed: false,
    transformLabel: null,
  };

  if (method === METHOD_IDS.PERCENTILE) {
    const r = computePercentilePpPpk(values, lsl, usl);
    if (!r) return fallbackParametric(values, lsl, usl, meta, rawAd);
    meta.methodLabel = "Percentile";
    meta.helpKey = "cap_percentile";
    meta.showReferenceNorm = true;
    return {
      ...r,
      displayValues: values,
      adStats: rawAd,
      meta,
      mean: jStat.median(values),
      overallSd: jStat.stdev(values, true),
    };
  }

  if (method === METHOD_IDS.BOXCOX && fits?.boxcox?.ok && fits.boxcox.adStats.p >= AD_TRANSFORM_MIN_P) {
    const fit = fits.boxcox;
    const specs = fit.forwardSpec(lsl, usl);
    if (!specs) return fallbackParametric(values, lsl, usl, meta, rawAd);
    const r = computeParametricPpPpk(fit.transformed, specs.lsl, specs.usl);
    meta.isTransformed = true;
    meta.transformLabel = fit.label;
    meta.transformedAdP = fit.adStats.p;
    meta.lambda = fit.lambda;
    meta.displayLsl = specs.lsl;
    meta.displayUsl = specs.usl;
    meta.showReferenceNorm = true;
    return {
      ...r,
      displayValues: fit.transformed,
      adStats: fit.adStats,
      meta,
    };
  }

  if (method === METHOD_IDS.JOHNSON && fits?.johnson?.ok && fits.johnson.adStats.p >= AD_TRANSFORM_MIN_P) {
    const fit = fits.johnson;
    const specs = fit.forwardSpec(lsl, usl);
    if (!specs) return fallbackParametric(values, lsl, usl, meta, rawAd);
    const r = computeParametricPpPpk(fit.transformed, specs.lsl, specs.usl);
    meta.isTransformed = true;
    meta.transformLabel = fit.label;
    meta.transformedAdP = fit.adStats.p;
    meta.johnsonFamily = fit.family;
    meta.displayLsl = specs.lsl;
    meta.displayUsl = specs.usl;
    meta.showReferenceNorm = true;
    return {
      ...r,
      displayValues: fit.transformed,
      adStats: fit.adStats,
      meta,
    };
  }

  if (method === METHOD_IDS.TAYLOR) {
    const taylor = evaluateTaylorHighCapability(values, Ppk_Norm, targetCpk);
    if (!taylor.met) {
      meta.taylor = taylor;
      return fallbackParametric(values, lsl, usl, meta, rawAd);
    }
    meta.taylor = taylor;
    meta.helpKey = "cap_taylor";
    const r = computeParametricPpPpk(values, lsl, usl);
    return {
      ...r,
      displayValues: values,
      adStats: rawAd,
      meta,
    };
  }

  const r = computeParametricPpPpk(values, lsl, usl);
  if (rawAd && rawAd.p < 0.05) meta.nonNormalWarning = true;
  return {
    ...r,
    displayValues: values,
    adStats: rawAd,
    meta,
  };
}

function fallbackParametric(values, lsl, usl, meta, rawAd) {
  const r = computeParametricPpPpk(values, lsl, usl);
  meta.methodId = METHOD_IDS.PARAMETRIC;
  return { ...r, displayValues: values, adStats: rawAd, meta };
}

export function isMethodApplicable(method, options) {
  const o = options.find((x) => x.id === method);
  return o?.applicable !== false;
}

export function getDefaultMethodForFailure(options) {
  const rec = options.find((o) => o.recommended && o.applicable);
  return rec?.id || METHOD_IDS.PARAMETRIC;
}
