/* global jStat */

import { calculateAndersonDarling } from "./stats.js";

function geometricMean(values) {
  if (values.some((v) => v <= 0)) return null;
  const logs = values.map((v) => Math.log(v));
  return Math.exp(jStat.mean(logs));
}

/** Minitab-style Box-Cox: T = (Y^λ - 1) / (λ · G^(λ-1)), λ=0 → ln(Y). */
export function boxCoxTransform(values, lambda, geomMean) {
  const G = geomMean ?? geometricMean(values);
  if (!G || G <= 0) return null;
  return values.map((y) => {
    if (y <= 0) return NaN;
    if (Math.abs(lambda) < 1e-8) return Math.log(y / G);
    return (Math.pow(y, lambda) - 1) / (lambda * Math.pow(G, lambda - 1));
  });
}

export function invBoxCox(t, lambda, geomMean) {
  if (Math.abs(lambda) < 1e-8) return geomMean * Math.exp(t);
  const inner = lambda * t * Math.pow(geomMean, lambda - 1) + 1;
  if (inner <= 0) return NaN;
  return Math.pow(inner, 1 / lambda);
}

function boxCoxAdP(values, lambda) {
  const G = geometricMean(values);
  if (!G) return { p: 0, lambda, geomMean: G, transformed: null };
  const transformed = boxCoxTransform(values, lambda, G).filter((v) => Number.isFinite(v));
  if (transformed.length < values.length) return { p: 0, lambda, geomMean: G, transformed: null };
  const ad = calculateAndersonDarling(transformed);
  return { p: ad.p, lambda, geomMean: G, transformed, adStats: ad };
}

/** Grid search λ ∈ [-2, 2]; maximize Anderson–Darling p (Minitab IDI criterion). */
export function fitBoxCox(values) {
  const min = Math.min(...values);
  if (min <= 0) {
    return { ok: false, reason: "Box-Cox requires all values > 0." };
  }
  let best = { p: -1, lambda: 1, geomMean: geometricMean(values), transformed: null, adStats: { p: 0, A2: 0 } };
  for (let lam = -2; lam <= 2.001; lam += 0.05) {
    const r = boxCoxAdP(values, lam);
    if (r.transformed && r.p > best.p) best = { ...r, ok: true };
  }
  let refine = best.lambda;
  for (let lam = refine - 0.04; lam <= refine + 0.04; lam += 0.01) {
    const r = boxCoxAdP(values, lam);
    if (r.transformed && r.p > best.p) best = { ...r, ok: true };
  }
  if (!best.transformed) return { ok: false, reason: "Could not fit Box-Cox." };
  return {
    ok: true,
    lambda: best.lambda,
    geomMean: best.geomMean,
    transformed: best.transformed,
    adStats: best.adStats,
    forwardSpec(lsl, usl) {
      const tL = boxCoxTransform([lsl], best.lambda, best.geomMean)[0];
      const tU = boxCoxTransform([usl], best.lambda, best.geomMean)[0];
      return { lsl: Math.min(tL, tU), usl: Math.max(tL, tU) };
    },
    label: `Box-Cox (λ=${best.lambda.toFixed(2)})`,
    helpKey: "cap_boxcox",
  };
}

const Z50 = 0;
function zQuantile(p) {
  return jStat.normal.inv(p, 0, 1);
}

function percentile(sorted, p) {
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function johnsonSuTransform(x, xi, lam, gamma, delta) {
  return gamma + delta * Math.asinh((x - xi) / lam);
}

function johnsonSlTransform(x, xi, lam, gamma, delta) {
  if (x <= xi || lam <= 0) return NaN;
  return gamma + delta * Math.log((x - xi) / lam);
}

function johnsonSbTransform(x, xi, lam, gamma, delta) {
  const denom = lam + xi - x;
  if (x <= xi || denom <= 0 || lam <= 0) return NaN;
  return gamma + delta * Math.log((x - xi) / denom);
}

function fitJohnsonFamily(values, family) {
  const sorted = [...values].sort((a, b) => a - b);
  const p135 = percentile(sorted, 0.135);
  const p50 = percentile(sorted, 0.5);
  const p865 = percentile(sorted, 0.865);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;
  if (range <= 0) return null;

  let xi, lam, gamma, delta, transformFn;

  if (family === "SU") {
    xi = p50;
    lam = Math.max((p865 - p135) / 2, range * 0.01);
    const z135 = johnsonSuTransform(p135, xi, lam, 0, 1);
    const z865 = johnsonSuTransform(p865, xi, lam, 0, 1);
    delta = (zQuantile(0.865) - zQuantile(0.135)) / (z865 - z135 || 1);
    gamma = Z50 - delta * johnsonSuTransform(p50, xi, lam, 0, 1);
    transformFn = (x) => johnsonSuTransform(x, xi, lam, gamma, delta);
  } else if (family === "SL") {
    xi = Math.min(min - range * 0.01, p135 - range * 0.05);
    lam = Math.max(p50 - xi, range * 0.01);
    const z135 = johnsonSlTransform(p135, xi, lam, 0, 1);
    const z865 = johnsonSlTransform(p865, xi, lam, 0, 1);
    delta = (zQuantile(0.865) - zQuantile(0.135)) / (z865 - z135 || 1);
    gamma = Z50 - delta * johnsonSlTransform(p50, xi, lam, 0, 1);
    transformFn = (x) => johnsonSlTransform(x, xi, lam, gamma, delta);
  } else {
    xi = min - range * 0.01;
    lam = range * 1.02;
    const z135 = johnsonSbTransform(p135, xi, lam, 0, 1);
    const z865 = johnsonSbTransform(p865, xi, lam, 0, 1);
    delta = (zQuantile(0.865) - zQuantile(0.135)) / (z865 - z135 || 1);
    gamma = Z50 - delta * johnsonSbTransform(p50, xi, lam, 0, 1);
    transformFn = (x) => johnsonSbTransform(x, xi, lam, gamma, delta);
  }

  const transformed = values.map(transformFn).filter((v) => Number.isFinite(v));
  if (transformed.length < values.length * 0.9) return null;
  const ad = calculateAndersonDarling(transformed);
  return {
    family,
    xi,
    lam,
    gamma,
    delta,
    transformed,
    adStats: ad,
    transformFn,
    forwardSpec(lsl, usl) {
      const tL = transformFn(lsl);
      const tU = transformFn(usl);
      if (!Number.isFinite(tL) || !Number.isFinite(tU)) return null;
      return { lsl: Math.min(tL, tU), usl: Math.max(tL, tU) };
    },
    label: `Johnson ${family}`,
    helpKey: "cap_johnson",
  };
}

/** Try Johnson Sb, Sl, Su; pick best AD p (Minitab IDI). */
export function fitJohnson(values) {
  const families = [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max > min) families.push("SB");
  if (min > 0 || values.every((v) => v > 0)) families.push("SL");
  families.push("SU");

  let best = null;
  for (const f of families) {
    const fit = fitJohnsonFamily(values, f);
    if (!fit) continue;
    if (!best || fit.adStats.p > best.adStats.p) best = fit;
  }
  if (!best) return { ok: false, reason: "Could not fit Johnson transformation." };
  return { ok: true, ...best };
}
