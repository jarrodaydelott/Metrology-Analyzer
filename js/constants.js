export const PDF_MIN_SCALE = 0.1;
export const PDF_MAX_SCALE = 5.0;

export const D2_CONSTANTS = {
  2: 1.128,
  3: 1.693,
  4: 2.059,
  5: 2.326,
  6: 2.534,
  7: 2.704,
  8: 2.847,
  9: 2.97,
  10: 3.078,
};

export const chartExplanations = {
  process: {
    title: "I-Chart or Xbar-Chart",
    content: "Monitors process average. Points outside limits indicate instability/shifts.",
  },
  variation: {
    title: "MR-Chart or R-Chart",
    content: "Monitors process consistency (Range). If this is unstable, Xbar limits are invalid.",
  },
  run: { title: "Run Chart", content: "Raw data plot. Best for spotting outliers, trends, or stratification." },
  histogram: {
    title: "Capability Histogram",
    content: "Visualizes distribution vs Specs. Check for centering and bell-curve shape.",
  },
  prob: {
    title: "Normal Probability Plot",
    content: "Tests normality. Straight line = Normal. Curves = Non-Normal (P < 0.05).",
  },
  cap: { title: "Capability Statistics", content: "Cpk = Potential. Ppk = Actual. Target > 1.33." },
  normality_flags: { title: "Normality Flags", content: "Green = Symmetric. Red = Highly Skewed (|Skew| > 1.0)." },
  ppk_percentile: {
    title: "Non-Parametric (Percentile) Method",
    content: `<div class="space-y-3"><div><strong class="text-blue-400">Why use this?</strong><p>The data failed the Normality Test (P < 0.05). Standard Ppk calculations mathematically <em>assume</em> a perfect Bell Curve. Applying standard math to non-normal data produces false risk estimates (e.g., saying a process is capable when it is actually making defects).</p></div><div><strong class="text-blue-400">How is it calculated?</strong><p>Instead of using Sigma (Standard Deviation), we use the actual physical spread of your data.</p><ul class="list-disc list-inside mt-1 ml-1 text-xs text-slate-400"><li><strong>Ppk:</strong> Uses the distance between the Median and the 99.865th percentile (or 0.135th).</li><li><strong>Pp:</strong> (USL - LSL) / (99.865th percentile - 0.135th percentile).</li></ul><p class="mt-1">This range represents 99.73% of your actual data points, equivalent to the &plusmn;3&sigma; range in a normal distribution.</p></div><div class="bg-slate-700/50 p-2 rounded border-l-2 border-green-500"><strong class="text-green-400 text-xs uppercase">Audit Defense Statement</strong><p class="italic text-slate-300">"Standard Cpk/Ppk indices were rejected because the data distribution is non-normal (Anderson-Darling P < 0.05). The ISO/AIAG non-parametric percentile method was selected to provide a conservative and accurate representation of actual process performance."</p></div></div>`,
  },
  spc_verdict: {
    title: "Run-Level Verdict",
    content: "<strong>Common Cause:</strong> System noise. <strong>Special Cause:</strong> Specific events/outliers.",
  },
  spc_stability: {
    title: "Cavity Stability",
    content: "<strong>>75%:</strong> High Risk. <strong><50%:</strong> Stable.",
  },
  spc_interpretation: {
    title: "Interpretation",
    content: "Links stats to molding physics (Pack, Flow, Cooling).",
  },
  spc_risk: {
    title: "Risk Ranking",
    content: "Prioritizes dimensions based on tolerance usage and failure mode (Variation vs Centering).",
  },
};

export const AI_INTRO_TEMPLATE = `<div class="ai-helper-content"><p class="ai-intro"><strong>Analysis Context:</strong> The current data view has been analyzed for normality, outliers, and capability issues.</p><div class="ai-checklist"><h4>General Diagnosis:</h4><ul><li id="tip-cavity-mixing"><strong>1. Bimodal/Multimodal Data</strong><br><em>Diagnosis:</em> You are likely mixing two or more different "populations" of data.<br><em>Action:</em> Check your Cavity Grouping. Filter to a single cavity.</li><li id="tip-process-drift"><strong>2. Trending Data (Drift)</strong><br><em>Diagnosis:</em> The process mean is moving over time (instability).<br><em>Action:</em> Check Thermal Equilibrium. Ensure machine is 'thermal soaked' before re-sampling.</li><li id="tip-boundary"><strong>3. Truncated/Skewed Data</strong><br><em>Diagnosis:</em> Common for GD&T like Flatness/Runout bounded by zero.<br><em>Action:</em> Do not attempt to fix. Use Non-Parametric (Percentile) Analysis.</li><li id="tip-resolution"><strong>4. Granular Data</strong><br><em>Diagnosis:</em> Measurement resolution is too low relative to tolerance.<br><em>Action:</em> Use a gauge capable of reading 1/10th of tolerance bandwidth.</li><li id="tip-outliers"><strong>5. Flyers (Outliers)</strong><br><em>Diagnosis:</em> Special Cause variation (flash, short shots).<br><em>Action:</em> Inspect specific parts. Use "Remove Outliers" button if defective.</li></ul></div></div>`;

export const SPC_AI_TEMPLATE = `<div class="ai-helper-content"><h3><i class="fa-solid fa-robot"></i> SPC Expert Review</h3><p class="ai-intro">Analyzing Common vs Special Cause variation.</p><div class="space-y-4"><div class="bg-slate-900/50 p-3 rounded border border-blue-500/30"><h4 class="text-sm font-bold text-blue-400">Common Cause</h4><p class="text-xs text-slate-300">System noise (Machine/Mold precision).</p></div><div class="bg-slate-900/50 p-3 rounded border border-orange-500/30"><h4 class="text-sm font-bold text-orange-400">Special Cause</h4><p class="text-xs text-slate-300">Specific events (Outliers, Blockages).</p></div></div></div>`;

export const LENS_W = 300;
export const LENS_H = 250;

export const SLIDE_W_INCHES = 13.33;
export const SLIDE_H_INCHES = 7.5;
export const CHART_TARGET_H_INCHES = 4.6;
export const CHART_TARGET_W_INCHES = 12.15;
export const BRAND_DARK_BLUE = "033063";
export const BRAND_ORANGE = "FF9900";
