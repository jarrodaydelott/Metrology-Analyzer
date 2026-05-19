/* global jStat */

function calculateSkewness(data, mean, std) {
  if (data.length < 3 || std === 0) return 0;
  let sum = 0;
  data.forEach((v) => {
    sum += Math.pow((v - mean) / std, 3);
  });
  return (sum * data.length) / ((data.length - 1) * (data.length - 2));
}

function getNormalitySuggestion(analysis) {
  const { isMultimodal, hasTrend, featureName } = analysis;
  const name = featureName ? featureName.toLowerCase() : "";
  if (isMultimodal) {
    return "⚠️ <strong>Mixed populations detected.</strong> You are analyzing multiple cavities or series together, which creates a non-normal (bimodal) distribution. Filter to a single cavity before interpreting Cpk/Ppk — combined data inflates sigma and hides which cavity is actually failing.";
  }
  if (hasTrend) {
    return "⚠️ <strong>Process drift detected.</strong> The mean is moving over time, most commonly because the machine or mold has not reached thermal equilibrium. Allow 30–60 minutes of soak after start-up, then re-sample. Do not adjust parameters based on early-run data.";
  }
  if (
    name.includes("flatness") ||
    name.includes("position") ||
    name.includes("runout") ||
    name.includes("profile") ||
    name.includes("concentricity")
  ) {
    return "ℹ️ <strong>Expected non-normality.</strong> Zero-bounded GD&T (flatness, position, runout, etc.) cannot go below zero, so the distribution is naturally skewed. This is not a process defect. Use the Non-Parametric (Percentile) Ppk for lot acceptance — do not attempt to center the data.";
  }
  return "⚠️ <strong>Unstable or non-normal process.</strong> The distribution shape is not a bell curve. Check the Run Chart for outliers (flyers, short shots) or stratification (mixed lots/cavities). Inspect flagged parts physically before removing data. Use percentile Ppk if normality cannot be achieved.";
}

function calculateTrend(values) {
  const n = values.length;
  if (n < 2) return 0;
  const x = Array.from({ length: n }, (_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = jStat.mean(values);
  let num = 0,
    den1 = 0,
    den2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = values[i] - meanY;
    num += dx * dy;
    den1 += dx * dx;
    den2 += dy * dy;
  }
  return den1 === 0 || den2 === 0 ? 0 : num / Math.sqrt(den1 * den2);
}

function getQuantile(arr, q) {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function calculateAndersonDarling(data) {
  const Y = [...data].sort((a, b) => a - b);
  const n = Y.length;
  const mean = jStat.mean(Y);
  const s = jStat.stdev(Y, true);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const Z = (Y[i] - mean) / s;
    const p = jStat.normal.cdf(Z, 0, 1);
    const pClamped = Math.max(1e-10, Math.min(1 - 1e-10, p));
    const term1 = Math.log(pClamped);
    const Z_rev = (Y[n - 1 - i] - mean) / s;
    const p_rev = jStat.normal.cdf(Z_rev, 0, 1);
    const pRevClamped = Math.max(1e-10, Math.min(1 - 1e-10, p_rev));
    const term2 = Math.log(1 - pRevClamped);
    sum += (2 * (i + 1) - 1) * (term1 + term2);
  }
  const A2 = -n - sum / n;
  const A2_adj = A2 * (1 + 0.75 / n + 2.25 / (n * n));
  let pVal = 0;
  if (A2_adj >= 0.6) pVal = Math.exp(1.2937 - 5.709 * A2_adj + 0.0186 * Math.pow(A2_adj, 2));
  else if (A2_adj >= 0.34) pVal = Math.exp(0.9177 - 4.279 * A2_adj - 1.38 * Math.pow(A2_adj, 2));
  else if (A2_adj > 0.2) pVal = 1 - Math.exp(-8.318 + 42.796 * A2_adj - 59.938 * Math.pow(A2_adj, 2));
  else pVal = 1 - Math.exp(-13.436 + 101.14 * A2_adj - 223.73 * Math.pow(A2_adj, 2));
  return { A2: A2_adj, p: pVal };
}

function checkRangeControl(subgroups, subSize) {
  if (subgroups.length < 2) return { isStable: true, hasZeros: false };
  const ranges = subgroups.map((g) => (g.mr !== undefined ? g.mr : g.range));
  if (subSize === 1) ranges.shift();
  const rBar = jStat.mean(ranges);
  const D4_MAP = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114 };
  let d4 = D4_MAP[subSize] || 2.114;
  if (subSize === 1) d4 = 3.267;
  const ucl = rBar * d4;
  const violations = ranges.filter((r) => r > ucl).length;
  const zeros = ranges.filter((r) => r === 0).length;
  return { isStable: violations === 0, hasZeros: zeros > ranges.length * 0.2 };
}

export {
  calculateSkewness,
  getNormalitySuggestion,
  calculateTrend,
  getQuantile,
  calculateAndersonDarling,
  checkRangeControl,
};
