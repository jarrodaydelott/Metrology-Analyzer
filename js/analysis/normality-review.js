import {
  calculateAndersonDarling,
  calculateRyanJoiner,
  calculateKolmogorovSmirnov,
  NORMALITY_TEST_IDS,
  NORMALITY_ALPHA,
} from "../math/stats.js";
import { AD_TRANSFORM_MIN_P, METHOD_IDS } from "./capability-methods.js";

const TEST_ORDER = [
  NORMALITY_TEST_IDS.ANDERSON_DARLING,
  NORMALITY_TEST_IDS.RYAN_JOINER,
  NORMALITY_TEST_IDS.KOLMOGOROV_SMIRNOV,
];

const TEST_LABELS = {
  [NORMALITY_TEST_IDS.ANDERSON_DARLING]: "Anderson–Darling",
  [NORMALITY_TEST_IDS.RYAN_JOINER]: "Ryan–Joiner",
  [NORMALITY_TEST_IDS.KOLMOGOROV_SMIRNOV]: "Kolmogorov–Smirnov",
};

/** Program default: Anderson–Darling gates recommendations, transforms, and capability panel. */
export function runAllNormalityTests(values) {
  const data = values || [];
  return {
    [NORMALITY_TEST_IDS.ANDERSON_DARLING]: calculateAndersonDarling(data),
    [NORMALITY_TEST_IDS.RYAN_JOINER]: calculateRyanJoiner(data),
    [NORMALITY_TEST_IDS.KOLMOGOROV_SMIRNOV]: calculateKolmogorovSmirnov(data),
  };
}

function formatTestLine(stats) {
  const pass = stats.p >= NORMALITY_ALPHA;
  const stat = stats.statistic ?? stats.A2 ?? 0;
  return {
    pass,
    line: `${stats.testLabel} P = ${stats.p.toFixed(3)} (${stats.statLabel} = ${stat.toFixed(3)})`,
  };
}

function getRootCauseGuidance(analysis) {
  const { isMultimodal, hasTrend, featureName } = analysis;
  const name = featureName ? featureName.toLowerCase() : "";
  if (isMultimodal) {
    return {
      priority: "data",
      headline: "Mixed populations (multiple cavities or series combined)",
      actions: [
        "Filter to a single cavity or lot before interpreting Ppk or choosing a capability method.",
        "An S-curve on the probability plot usually confirms bimodal data — do not merge populations for lot acceptance.",
      ],
    };
  }
  if (hasTrend) {
    return {
      priority: "data",
      headline: "Process drift over the sampling window",
      actions: [
        "Stabilize the process (thermal soak, consistent setup) and re-sample before normality or capability decisions.",
        "Parametric and transformed Ppk both assume a stable population — drift invalidates any single distribution fit.",
      ],
    };
  }
  if (
    name.includes("flatness") ||
    name.includes("position") ||
    name.includes("runout") ||
    name.includes("profile") ||
    name.includes("concentricity")
  ) {
    return {
      priority: "boundary",
      headline: "Expected non-normality for zero-bounded GD&T",
      actions: [
        "Use <strong>Non-Parametric (Percentile)</strong> for lot acceptance — do not try to center toward nominal.",
        "A failed Anderson–Darling test here reflects physics (cannot be negative), not necessarily poor control.",
      ],
    };
  }
  return {
    priority: "shape",
    headline: "Distribution shape is not a bell curve on raw data",
    actions: [
      "Read the probability plot: S-curve = mixed data; banana tail = skew/outliers; flat bottom = physical bound.",
      "Inspect Run Chart outliers physically before removing points.",
    ],
  };
}

function buildTestComparison(allTests, selectedId, adStats) {
  const adPass = adStats.p >= NORMALITY_ALPHA;
  const selected = allTests[selectedId];
  const selectedPass = selected?.p >= NORMALITY_ALPHA;
  const lines = [];

  if (selectedId !== NORMALITY_TEST_IDS.ANDERSON_DARLING) {
    if (adPass && !selectedPass) {
      lines.push({
        type: "caution",
        text: `<strong>Display test vs. program review:</strong> ${TEST_LABELS[selectedId]} rejects normality (P = ${selected.p.toFixed(3)}), but <strong>Anderson–Darling passes</strong> (P = ${adStats.p.toFixed(3)}). This app still treats the data as <strong>normal for capability</strong> because AD is the default review method. You may switch the display test to Anderson–Darling to align the panel with recommendations, or keep ${TEST_LABELS[selectedId]} for sensitivity in the center of the distribution.`,
      });
    } else if (!adPass && selectedPass) {
      lines.push({
        type: "warn",
        text: `<strong>Display test vs. program review:</strong> ${TEST_LABELS[selectedId]} passes (P = ${selected.p.toFixed(3)}), but <strong>Anderson–Darling fails</strong> (P = ${adStats.p.toFixed(3)}). Capability recommendations, transforms, and the method panel follow <strong>AD only</strong> (Minitab IDI / tail-sensitive practice). Do not report parametric Ppk as lot acceptance without addressing AD failure or selecting an alternate method below.`,
      });
    }
  }

  const others = TEST_ORDER.filter((id) => id !== selectedId && id !== NORMALITY_TEST_IDS.ANDERSON_DARLING);
  const disagree = others.filter((id) => {
    const t = allTests[id];
    return t && (t.p >= NORMALITY_ALPHA) !== adPass;
  });
  if (disagree.length > 0 && selectedId === NORMALITY_TEST_IDS.ANDERSON_DARLING) {
    const names = disagree.map((id) => `${TEST_LABELS[id]} (P = ${allTests[id].p.toFixed(3)})`).join(", ");
    lines.push({
      type: "info",
      text: `<strong>Borderline disagreement:</strong> AD ${adPass ? "passes" : "fails"} while ${names} ${disagree.length === 1 ? "disagrees" : "disagree"}. On borderline data, Ryan–Joiner is often stricter in the body of the distribution; Kolmogorov–Smirnov is often more lenient in the tails than AD. Use the probability plot shape as the tie-breaker — not P-values alone.`,
    });
  }

  return lines;
}

function pickRecommendedMethod(options) {
  const rec = options?.find((o) => o.recommended && o.applicable !== false);
  return rec || options?.find((o) => o.applicable !== false && o.id === METHOD_IDS.PERCENTILE) || null;
}

/**
 * @param {object} params
 * @returns {object} Review payload for UI and expert analysis
 */
export function buildNormalityReview(params) {
  const {
    values,
    selectedTestId,
    analysis,
    capabilityOptions,
  } = params;

  const allTests = runAllNormalityTests(values);
  const adStats = allTests[NORMALITY_TEST_IDS.ANDERSON_DARLING];
  const selectedStats = allTests[selectedTestId] || adStats;
  const isNormalByAD = adStats.p >= NORMALITY_ALPHA;
  const rootCause = getRootCauseGuidance(analysis);
  const comparison = buildTestComparison(allTests, selectedTestId, adStats);
  const recommendedMethod = pickRecommendedMethod(capabilityOptions);

  const transformNotes = [];
  const box = capabilityOptions?.find((o) => o.id === METHOD_IDS.BOXCOX);
  const johnson = capabilityOptions?.find((o) => o.id === METHOD_IDS.JOHNSON);
  if (box?.applicable) {
    transformNotes.push(
      `Box-Cox achieved transformed AD P = ${box.adP?.toFixed(3)} (≥ ${AD_TRANSFORM_MIN_P.toFixed(2)}). Suitable for right-skewed <strong>strictly positive</strong> dimensions when not zero-bounded.`,
    );
  } else if (box && box.adP != null) {
    transformNotes.push(
      `Box-Cox fit attempted; transformed AD P = ${box.adP.toFixed(3)} (need ≥ ${AD_TRANSFORM_MIN_P.toFixed(2)}). ${box.blockedReason || "Not recommended for this dataset."}`,
    );
  }
  if (johnson?.applicable) {
    transformNotes.push(
      `Johnson (${johnson.detail || "fitted"}) — use when data include zero/negative values or Box-Cox cannot normalize.`,
    );
  } else if (johnson && johnson.adP != null) {
    transformNotes.push(
      `Johnson fit attempted; transformed AD P = ${johnson.adP.toFixed(3)}. ${johnson.blockedReason || ""}`,
    );
  }

  const whyChangeTest = [
    "<strong>Keep Anderson–Darling (default)</strong> for capability decisions, transform selection, and audit alignment with Minitab. AD weights the tails where defect rates are estimated.",
    "<strong>Try Ryan–Joiner</strong> when the probability plot looks fairly straight but AD fails — RJ correlates with normal scores (similar to Shapiro–Wilk) and can flag non-normality in the <em>center</em> of the distribution that AD understates on small n.",
    "<strong>Try Kolmogorov–Smirnov</strong> only for exploratory comparison — it is often less sensitive in the tails than AD, so a KS pass with AD fail still means tail risk for Ppk may be understated.",
    "<strong>Changing the display test does not change</strong> Box-Cox/Johnson λ selection or which capability methods are offered — those always use AD on raw and transformed data.",
  ];

  const whyChangeTransform = [
    "<strong>Capability method ≠ normality test.</strong> The normality test judges raw (or display) data shape. A <em>transformation</em> (Box-Cox / Johnson) is chosen to make data approximately normal so <strong>parametric Pp/Ppk on a transformed scale</strong> are defensible — only when transformed AD P ≥ 0.10 (Minitab IDI).",
    "<strong>Percentile (nonparametric)</strong> — no transform; uses empirical 0.135th / 99.865th percentiles. Best default for zero-bounded GD&T, heavy skew, or when transforms cannot reach AD P ≥ 0.10.",
    "<strong>Box-Cox</strong> — power transform for all-positive, right-skewed data (e.g., weight, positive deviations). Not for features physically bounded at zero.",
    "<strong>Johnson</strong> — when zeros/negatives exist or Box-Cox fails; maps bounded/unbounded families toward normality.",
    "<strong>Taylor STAT-18</strong> — waives normality for <em>variables sampling</em> when Ppk is very high and skew is mild; does not change the formula, documents acceptance rationale.",
    "<strong>Parametric on raw data</strong> — reference only when AD fails unless Taylor criteria apply; can overstate Ppk on skewed data.",
  ];

  const sections = [];

  if (!isNormalByAD) {
    sections.push({
      title: "Program review (Anderson–Darling)",
      html: `<p class="normality-review-msg-fail">Raw data <strong>failed</strong> Anderson–Darling (P = ${adStats.p.toFixed(3)}, α = ${NORMALITY_ALPHA}). Overall parametric Pp/Ppk on untransformed data are not assumed valid for lot acceptance unless you select another capability method.</p>`,
    });
    sections.push({
      title: "Likely cause",
      html: `<p><strong>${rootCause.headline}</strong></p><ul class="list-disc list-inside ml-1 text-slate-400">${rootCause.actions.map((a) => `<li>${a}</li>`).join("")}</ul>`,
    });
    if (recommendedMethod) {
      sections.push({
        title: "Recommended capability method",
        html: `<p><strong>${recommendedMethod.title}</strong> — ${recommendedMethod.short}</p><p class="text-slate-500 text-[11px] mt-1">${recommendedMethod.detail || ""}</p>`,
      });
    }
    if (transformNotes.length) {
      sections.push({
        title: "Transformation screening (always uses AD)",
        html: `<ul class="list-disc list-inside ml-1 text-slate-400">${transformNotes.map((t) => `<li>${t}</li>`).join("")}</ul>`,
      });
    }
    sections.push({
      title: "When to change the normality test (display only)",
      html: `<ul class="list-disc list-inside ml-1 text-slate-400">${whyChangeTest.map((t) => `<li>${t}</li>`).join("")}</ul>`,
    });
    sections.push({
      title: "When to change capability method / transformation",
      html: `<ul class="list-disc list-inside ml-1 text-slate-400">${whyChangeTransform.map((t) => `<li>${t}</li>`).join("")}</ul>`,
    });
  } else if (selectedTestId !== NORMALITY_TEST_IDS.ANDERSON_DARLING && selectedStats.p < NORMALITY_ALPHA) {
    sections.push({
      title: "Display test note",
      html: `<p class="text-slate-400">Anderson–Darling <strong>passes</strong> (P = ${adStats.p.toFixed(3)}). Your selected ${TEST_LABELS[selectedTestId]} test fails (P = ${selectedStats.p.toFixed(3)}) — capability still uses AD. Switch the display test to Anderson–Darling to align the panel, or keep ${TEST_LABELS[selectedTestId]} for a center-weighted second opinion.</p>`,
    });
  }

  const adLine = formatTestLine(adStats);
  const selectedLine = formatTestLine(selectedStats);

  return {
    isNormalByAD,
    adStats,
    selectedStats,
    allTests,
    adLine,
    selectedLine,
    comparison,
    rootCause,
    recommendedMethod,
    sections,
    whyChangeTest,
    whyChangeTransform,
    summaryWarning: !isNormalByAD
      ? `Anderson–Darling P = ${adStats.p.toFixed(3)} (non-normal). ${rootCause.headline}.`
      : null,
    shortSuggestion: !isNormalByAD
      ? getShortSuggestion(analysis, recommendedMethod)
      : null,
  };
}

function getShortSuggestion(analysis, recommendedMethod) {
  const rc = getRootCauseGuidance(analysis);
  const methodHint = recommendedMethod
    ? ` Recommended: <strong>${recommendedMethod.title}</strong>.`
    : " Open the Capability Method panel to compare options.";
  if (rc.priority === "boundary") {
    return `AD failed as expected for this GD&T type — not a defect.${methodHint}`;
  }
  if (rc.priority === "data") {
    return `Fix mixed populations or drift first.${methodHint}`;
  }
  return `Standard Ppk may overstate protection.${methodHint}`;
}

export function renderNormalityReviewHtml(review) {
  if (!review?.sections?.length) return "";
  return review.sections
    .map(
      (s) =>
        `<div class="mt-3 pt-3 border-t border-slate-700/80 first:mt-0 first:pt-0 first:border-0"><h4 class="text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">${s.title}</h4>${s.html}</div>`,
    )
    .join("");
}
