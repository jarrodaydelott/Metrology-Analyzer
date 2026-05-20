/* global jStat */

import { checkRangeControl } from "../math/stats.js";
import { currentAiState } from "../state.js";

window.currentInsights = {};

export function addBulb(chartId, title, observation, tips) {
  const safeTips = Array.isArray(tips) ? tips : [tips];
  window.currentInsights[chartId] = { title, observation, tips: safeTips };
}

export function applySixPackBulbs() {
  const insights = window.currentInsights || {};
  if (insights.spChart6 && !insights.spStats) {
    insights.spStats = insights.spChart6;
  }
  document.querySelectorAll(".pulsing-bulb").forEach((el) => el.classList.add("hidden"));
  for (const chartId of Object.keys(insights)) {
    document.getElementById(`bulb-${chartId}`)?.classList.remove("hidden");
  }
}

export function runExpertAnalysis(ctx, dimName) {
  const {
    Cp,
    Cpk,
    Pp,
    Ppk,
    overallMean,
    overallStDev,
    withinStDev,
    trend,
    isNormal,
    normalityTestLabel,
    tolerance,
    subSize,
    subgroups,
    targetCpk,
    lsl,
    usl,
  } = ctx;
  const rangeControl = checkRangeControl(subgroups, subSize);
  const isRangeStable = rangeControl.isStable;

  // 1. Process Drift (Trend)
  if (Math.abs(trend) > 0.5) {
    addBulb(
      "spChart1",
      "Process Drift Detected",
      "The process mean is moving consistently in one direction over time. This is not random noise — it is a systematic change, most commonly caused by the machine or mold not yet being at thermal equilibrium. Early shots are often measurably different from later shots.",
      [
        "<strong>Why this matters:</strong> Capability indices (Cpk/Ppk) average over the entire run. If the mean is drifting, you may be approving parts from one end of the run while parts from the other end are already out of spec.",
        "<strong>Thermal soak:</strong> After any machine start-up, mold change, or extended downtime, allow a minimum of 30–60 minutes of production (or idle soak per your plant standard) before collecting capability data.",
        "<strong>Verify barrel temperatures:</strong> Check that all barrel zones have reached setpoint and are not cycling. A zone that overshoots and cools back down will shift melt viscosity shot-to-shot.",
        "<strong>Check hydraulic oil temperature:</strong> Cold oil changes injection speed and pack pressure delivery. Confirm oil is at the machine manufacturer's operating range.",
        "<strong>Confirm mold temperature:</strong> Use a pyrometer on all mold halves and slides. Uneven mold temperature is the most common cause of cavity-to-cavity drift.",
        "<strong>Do not adjust steel or process yet:</strong> Wait until the Run Chart shows a flat, stable mean before making any corrective moves.",
      ],
    );
  }

  // 2. Range Control (MR/R Chart Stability)
  if (!isRangeStable) {
    addBulb(
      "spChart1",
      "Control Limits Are Unreliable",
      "The Range or Moving Range chart below is out of control. Because Xbar/I-Chart control limits are calculated from within-subgroup variation, any instability on the Range chart mathematically invalidates the limits shown on this chart. Decisions based on these limits may be wrong.",
      [
        "<strong>What this means statistically:</strong> The average range (within-subgroup spread) used to calculate UCL/LCL on this chart is inflated or unstable. Points appearing 'in control' here may not actually represent a stable process.",
        "<strong>Do not center the process yet:</strong> Shifting hold pressure, mold temperature, or cutting steel will not fix an underlying repeatability problem.",
        "<strong>Fix the Range chart first:</strong> Open the insight on the MR/R chart below and follow those troubleshooting steps.",
        "<strong>Re-sample after correction:</strong> Only re-evaluate capability once the Range chart shows points randomly scattered within limits with no patterns.",
      ],
    );
    addBulb(
      "spChart2",
      "Unstable Within-Subgroup Variation",
      "One or more subgroups exceed the Upper Control Limit on the Range/MR chart. This means consecutive shots (or parts within a subgroup) are more different from each other than the process normally allows — a special cause event has occurred.",
      [
        "<strong>What to look for on the shop floor:</strong> Identify the specific shots corresponding to the out-of-control range points on the Run Chart.",
        "<strong>Material feed:</strong> Check for bridging in the feed throat, inconsistent regrind ratio, or moisture in the material. A partial blockage causes shot-to-shot fill variation.",
        "<strong>Cushion consistency:</strong> Log cushion value for the flagged shots. Cushion variation greater than 2–3 mm typically indicates check ring wear or barrel wear.",
        "<strong>Check ring / non-return valve:</strong> Worn check rings are the single most common cause of shot-to-shot variation in injection molding. Inspect and replace if there is visible wear or sticking.",
        "<strong>Regrind contamination:</strong> Excessive or inconsistent regrind changes melt viscosity. Verify regrind percentage is controlled and material is properly dried.",
        "<strong>Clamp tonnage:</strong> Insufficient tonnage allows the mold to breathe (flash), adding random variation to all dimensions.",
      ],
    );
  } else if (rangeControl.hasZeros && subSize > 1) {
    addBulb(
      "spChart2",
      "Measurement Resolution Warning",
      "Multiple subgroup ranges are exactly zero, meaning consecutive parts measured identically. This usually indicates the gauge cannot resolve the true variation in the process — not that the process has zero variation.",
      [
        "<strong>Why this is dangerous:</strong> When a gauge cannot detect differences between parts, the calculated standard deviation is artificially low. Cp and Cpk will be <strong>overstated</strong>, giving false confidence that the process is capable.",
        "<strong>Apply the 10:1 rule:</strong> Gauge resolution must be ≤ 1/10th of the total tolerance band. Example: for a ±0.10 mm tolerance (0.20 mm total), the gauge must resolve to at least 0.01 mm.",
        "<strong>Check your data import:</strong> Verify that CMM or measurement data was not rounded during Excel export. Import full decimal precision.",
        "<strong>Read the gauge spec sheet:</strong> Look for 'resolution' or 'least count.' Compare it to your tolerance before trusting any capability number.",
        "<strong>Perform Gage R&R:</strong> If this dimension is critical, run a full Gage Repeatability & Reproducibility study per AIAG MSA before making capability decisions.",
      ],
    );
  }

  // 3. X-BAR CHART: Mathematical Limits Alert
  if (isRangeStable && Math.abs(trend) <= 0.5) {
    const sigmaX = withinStDev / Math.sqrt(subSize || 1);
    const uclX = overallMean + 3 * sigmaX;
    const lclX = overallMean - 3 * sigmaX;

    const oocX = subgroups.filter(
      (g) => g.mean > uclX + 0.000001 || g.mean < lclX - 0.000001,
    );

    if (oocX.length > 0) {
      addBulb(
        "spChart1",
        "Stability Alert: Process Mean Out of Control",
        `Found ${oocX.length} subgroup average(s) outside the ±3σ control limits. This is evidence of a special cause shift in the process mean — something changed at a specific point in the run, distinct from gradual drift.`,
        [
          "<strong>Shift vs. drift:</strong> A shift is a sudden step-change (tooling adjustment, material lot change, operator setup change). Drift is gradual (thermal). Check the Run Chart to determine which pattern you have.",
          "<strong>Identify the point of change:</strong> Find the exact shot number where the mean stepped. Correlate with the production log — was there a material lot change, maintenance event, or parameter adjustment at that time?",
          "<strong>Material lot change:</strong> Different lots can have different viscosity, affecting fill and pack. Verify lot number matches the setup sheet.",
          "<strong>Machine restart / recalibration:</strong> Was the machine stopped and restarted during this run? Post-restart shots are not comparable to pre-shutdown shots.",
          "<strong>Tooling change:</strong> Was any steel adjusted, a slide replaced, or a hot runner zone changed during the run?",
          "<strong>Do not combine pre- and post-shift data:</strong> Analyze only the stable portion of the run, or re-run after confirming the new mean is stable.",
        ],
      );
    }
  }

  // 4. R-CHART: Average Range Alert
  if (isRangeStable) {
    const avgRange = jStat.mean(
      subgroups.map((g) => (g.range !== undefined ? g.range : g.mr || 0)),
    );
    if (avgRange > tolerance * 0.1) {
      addBulb(
        "spChart2",
        "High Average Within-Subgroup Variation",
        "The average range on this chart is greater than 10% of your total tolerance band. Even when no individual point is above the UCL, this elevated average range is widening your process bell curve and consuming capability margin.",
        [
          "<strong>What this means for Cp:</strong> Cp is calculated from within-subgroup variation. A high average range directly lowers Cp — the process cannot fit within tolerance even if perfectly centered.",
          "<strong>Fixture and clamping:</strong> Verify the part is seated consistently in the measurement fixture. A loose or misaligned fixture adds apparent variation.",
          "<strong>Measurement repeatability:</strong> Have the same operator measure the same part 10 times. If spread is high, the gauge or method is contributing to the range.",
          "<strong>Thermal effects during the run:</strong> If the mold is still warming up, early shots will differ from later shots. Ensure thermal soak before sampling.",
          "<strong>Gate freeze study:</strong> If variation is pack-related, perform a gate freeze study to identify the correct hold time and pressure window.",
          "<strong>Check all cavities:</strong> One bad cavity can elevate the average range for the whole dataset — filter by cavity to isolate the source.",
        ],
      );
    }
  }

  // 5. General Capability & Shift Logic
  if (Math.abs(Cpk - Ppk) > 0.5) {
    addBulb(
      "spChart3",
      "Process Shift / Long-Term Instability",
      `There is a significant gap between Cpk (${Cpk?.toFixed?.(2) ?? Cpk}) and Ppk (${Ppk?.toFixed?.(2) ?? Ppk}). Cpk uses within-subgroup variation (short-term potential); Ppk uses overall variation (long-term actual). A large gap means the process is not staying consistent over the full sampling period.`,
      [
        "<strong>What this gap tells you:</strong> The process may be capable in the short term but is drifting, shifting, or mixing populations over the full run.",
        "<strong>Check the Run Chart for stratification:</strong> Look for distinct horizontal bands at different levels — this indicates mixed cavities, lots, or runs being analyzed together.",
        "<strong>Material lot changes:</strong> If multiple lots were run, each lot may have a different mean. Analyze each lot separately.",
        "<strong>Heater band cycling:</strong> A repeating up-and-down pattern on the Run Chart may correlate with barrel or mold heater cycling. Check for faulty thermocouples or PID tuning issues.",
        "<strong>Cavity mixing:</strong> If multiple cavities are in the dataset, filter to one cavity at a time before interpreting Cpk vs. Ppk.",
        "<strong>Do not report Cpk alone:</strong> When Cpk − Ppk > 0.5, Ppk is the more honest indicator of what the customer will actually receive.",
      ],
    );
  }

  if (currentAiState.isMixedCavity) {
    addBulb(
      "spChart4",
      "Mixed Population — Multiple Cavities Combined",
      "The histogram likely shows two or more distinct peaks (bimodal distribution). This occurs when measurements from different cavities — each with their own process mean — are analyzed as one combined dataset.",
      [
        "<strong>Why this inflates sigma:</strong> Combining cavities with different means artificially widens the calculated standard deviation. Cpk and Ppk will appear worse than any individual cavity actually performs.",
        "<strong>Immediate action:</strong> Use the Cavity/Series filter to analyze each cavity independently. Compare means and spreads side by side.",
        "<strong>What a balanced mold looks like:</strong> All cavities should have similar means and similar spreads. A cavity that is consistently high or low needs runner, gate, or cooling balance work.",
        "<strong>Do not adjust the process mean:</strong> Averaging a high cavity and low cavity mean to hit nominal leaves both cavities producing defects.",
        "<strong>Long-term fix:</strong> Perform a cavity balance study — adjust runner size, gate size, or cooling to bring all cavities into alignment.",
      ],
    );
  }

  if (currentAiState.isBoundary) {
    const boundaryTips = [
      "<strong>Why you cannot 'center' this:</strong> There is no negative flatness or runout. Attempting to shift the process mean toward nominal on a zero-bounded feature is physically meaningless and will mislead your corrective action.",
      "<strong>Choose a capability method:</strong> Open the Capability Method panel and select Non-Parametric (Percentile) — recommended for zero-bounded GD&T per Minitab/AIAG.",
      "<strong>Normality test will fail — that is OK:</strong> Anderson-Darling P < 0.05 is expected for zero-bounded GD&T. Do not treat a failed normality test as a process problem.",
      "<strong>Evaluate against USL only:</strong> Focus on how close the 99.865th percentile is to the upper spec limit, not on symmetry.",
      "<strong>Document in your quality plan:</strong> Note that percentile-based indices are the correct acceptance method for this feature type per ISO/AIAG guidance.",
    ];
    addBulb(
      "spChart4",
      "Physically Bounded (Truncated) Distribution",
      "Data is piled up near zero because this GD&T characteristic (Flatness, Profile, Position, Runout, etc.) cannot have negative values. The distribution is naturally right-skewed — this is expected physics, not a process defect.",
      boundaryTips,
    );
    addBulb(
      "spChart5",
      "Probability Plot — Zero-Bounded Feature",
      "The flat bottom on this plot is expected: the measurement cannot go below zero (flatness, profile, position, runout, etc.). Do not interpret the failed normality test as poor process control.",
      boundaryTips,
    );
  }

  const failedAD = ctx.isNormalByAD === false;
  if (failedAD && !currentAiState.isBoundary) {
    const adP = ctx.adStats?.p?.toFixed?.(3) ?? "—";
    const displayNote =
      ctx.normStats && ctx.adStats && ctx.normStats.p >= 0.05
        ? `<strong>Display test passes, AD fails:</strong> ${ctx.normalityTestLabel} P ≥ 0.05 but Anderson–Darling P = ${adP}. Lot acceptance should not rely on parametric raw Ppk until you pick a method below.`
        : "";
    const rec = ctx.normalityReview?.recommendedMethod;
    const recTip = rec
      ? `<strong>Recommended method:</strong> ${rec.title} — ${rec.short}`
      : "<strong>Capability Method panel:</strong> Compare percentile, Box-Cox, Johnson, Taylor STAT-18, and parametric (reference).";
    const taylorTip = ctx.taylor?.met
      ? "<strong>Taylor STAT-18:</strong> High Capability criteria are met — parametric Ppk may be documented with a normality waiver (see Taylor method)."
      : "";
    addBulb(
      "spChart5",
      "Non-Normal Distribution (Anderson–Darling Review)",
      `Anderson–Darling failed on raw data (P = ${adP}, α = 0.05). This is the program default review — transform fitting and capability recommendations always use AD, regardless of the display test selected above. Standard overall Ppk on untransformed data can overstate protection when tails are heavy or skewed.`,
      [
        displayNote,
        "<strong>Normality test vs. transformation:</strong> Changing Ryan–Joiner or K–S only changes what you <em>see</em> in the Tests panel. Changing Box-Cox, Johnson, or Percentile changes <em>how Pp/Ppk are calculated</em>. Open <strong>Test vs transform</strong> in that panel for the full decision guide.",
        "<strong>When to change the display test:</strong> Keep AD for audits and Minitab alignment. Try Ryan–Joiner if the prob plot looks straight but AD fails (center-weighted). K–S is exploratory — a KS pass with AD fail still leaves tail risk.",
        "<strong>When to change capability method:</strong> Percentile = no transform, empirical tails (best for zero-bounded GD&T). Box-Cox = all-positive skew. Johnson = zeros/negatives or Box-Cox failure. Use transform only if transformed AD P ≥ 0.10.",
        "<strong>Probability plot shapes:</strong> S-curve = mixed cavities/lots. Banana tail = skew/outliers. Flat bottom = physical lower bound.",
        "<strong>Fix data first:</strong> Filter mixed cavities and stabilize drift before trusting any transform.",
        recTip,
        taylorTip,
        "<strong>Do not ignore AD failure:</strong> Parametric Ppk on raw skewed data can overstate capability by 30–50% or more.",
      ].filter(Boolean),
    );
  }

  if (Cp < targetCpk) {
    const severity = Cp < 1.0 ? "Critical" : "Marginal";
    const spreadPct = ((1 / Cp) * 100).toFixed(0);
    const shotTips =
      subSize === 1
        ? [
            "<strong>Shot-to-shot instability:</strong> With subgroup size = 1, each point is one shot. High moving range means the machine cannot repeat the same fill and pack shot after shot.",
            "<strong>Non-return valve (check ring):</strong> Inspect for wear, sticking, or incorrect gap. Worn check rings are the #1 cause of cushion variation and shot weight variation.",
            "<strong>Cushion monitoring:</strong> Log cushion at every shot during sampling. Variation > 2–3 mm means inconsistent packing — parts are not being packed to the same density.",
            "<strong>Hold pressure stability:</strong> Verify the machine hydraulic system delivers consistent pack pressure. Spikes or drops during pack phase directly change part dimensions.",
          ]
        : [
            "<strong>Process spread is too wide:</strong> The within-subgroup variation consumes too much of the tolerance band. Centering the mean will not bring Cpk above target.",
            "<strong>Gate freeze study:</strong> Pack time and hold pressure window may be too narrow. A gate freeze study identifies the correct pack phase parameters.",
            "<strong>Clamp tonnage:</strong> Verify the machine is at the correct tonnage for this mold. Insufficient tonnage causes flash and dimensional variation.",
            "<strong>Mold venting:</strong> Poor venting causes trapped air and burn marks, but also inconsistent fill on some shots.",
          ];

    addBulb(
      "spChart6",
      `Consistency Issue (${severity})`,
      `The process spread (6σ) uses approximately ${spreadPct}% of the total tolerance band. Target Cp is ${targetCpk} (meaning spread should use ≤ ${((1 / targetCpk) * 100).toFixed(0)}% of tolerance). Until spread is reduced, no amount of mean adjustment will achieve a capable process.`,
      [
        "<strong>Do not center yet — this is critical:</strong> Adjusting hold pressure or cutting steel to move the mean on a high-variation process will not improve Cpk and may make other dimensions worse.",
        "<strong>Prioritize variation reduction:</strong> Follow the steps below in order. Re-measure after each change before proceeding to the next.",
        ...shotTips,
        "<strong>Re-evaluate after each fix:</strong> Re-run a short study (25–30 shots minimum) after each corrective action to confirm the Range chart has improved before moving on.",
      ],
    );

    if (!window.currentInsights["spChart2"]) {
      addBulb(
        "spChart2",
        "This Chart Controls Your Cp",
        "The height of the bars on the Range/MR chart represents within-subgroup variation — the same variation used to calculate Cp. Every point above average is widening your bell curve. Lowering the average range is the only way to improve Cp.",
        [
          "<strong>The math:</strong> Cp = Tolerance / (6 × σ_within). The within-subgroup standard deviation comes directly from the average range on this chart.",
          "<strong>What will NOT improve Cp:</strong> Adjusting the process mean, cutting steel, or changing mold temperature to shift dimensions.",
          "<strong>What WILL improve Cp:</strong> Reducing shot-to-shot variation — check ring, cushion stability, hold pressure consistency, gate freeze optimization.",
          "<strong>Target:</strong> Continue reducing average range until Cp ≥ your target before attempting any centering activity.",
        ],
      );
    }
  } else if (Cpk < targetCpk) {
    const target = tolerance / 2 + lsl;
    const isOversize = overallMean > target;
    const dimStatus = isOversize
      ? "Oversize (Mean > Nominal)"
      : "Undersize (Mean < Nominal)";
    const processActions = isOversize
      ? "<strong>To reduce oversized dimensions:</strong> Decrease 2nd-stage (hold/pack) pressure, increase cooling time to allow more shrinkage, or reduce mold temperature on the affected area."
      : "<strong>To increase undersized dimensions:</strong> Increase 2nd-stage (hold/pack) pressure, reduce cooling time (less shrinkage), or increase mold temperature on the affected area.";

    addBulb(
      "spChart6",
      'The "Centering" Problem — Good Spread, Wrong Target',
      `The process is repeatable (Cp is acceptable) but the average is off-target: ${dimStatus}. This is the ideal condition for corrective action because the process is already stable — you only need to move the mean, not fight variation.`,
      [
        "<strong>Confirm stability first:</strong> Verify the Range chart is in control before making any adjustments. A stable R-chart confirms the mean shift will be predictable.",
        processActions,
        "<strong>Process vs. steel decision:</strong> If the required shift is small (< 25% of tolerance), try process parameter adjustment first. If large, plan a tooling change.",
        "<strong>Steel-safe direction rules (tooling engineer guidance):</strong> For <strong>internal features (holes, bores):</strong> To make the hole larger → cut steel (remove material from the core pin). To make it smaller → weld/plate the pin (add steel). For <strong>external features (bosses, walls, OD):</strong> To make it larger → weld/plate the cavity. To make it smaller → cut steel from the cavity.",
        "<strong>Document before cutting:</strong> Record current mean, target nominal, required shift direction, and steel-safe direction on the tool modification request before any bench work.",
        "<strong>Re-sample after change:</strong> Run 25–30 shots after any adjustment and confirm the new mean is stable before submitting for approval.",
      ],
    );
  }

  if (!window.currentInsights.spStats) {
    if (window.currentInsights.spChart6) {
      window.currentInsights.spStats = window.currentInsights.spChart6;
    } else {
      addBulb(
        "spStats",
        "Capability Statistics",
        `Within Cpk is ${Cpk?.toFixed?.(2) ?? Cpk} (short-term potential). Overall Ppk is ${Ppk?.toFixed?.(2) ?? Ppk} (long-term actual). ${Math.abs(Cpk - Ppk) > 0.5 ? "A large Cpk − Ppk gap suggests drift or mixed data — filter cavities/runs before centering." : "Cpk and Ppk are aligned — focus on maintaining stability on the Range chart."}`,
        [
          "<strong>Cpk (within):</strong> Uses within-subgroup variation. Improve by reducing shot-to-shot spread (Range/MR chart).",
          "<strong>Ppk (overall):</strong> Uses total variation. Sensitive to drift, outliers, and mixing cavities or lots.",
          "<strong>Normality:</strong> Overall Pp/Ppk assume normality unless you select another method in the Capability Method panel.",
          "<strong>Target:</strong> Compare indices to your Target Cpk from the setup bar.",
        ],
      );
    }
  }
}
