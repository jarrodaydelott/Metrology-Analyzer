/* global jStat */

import { checkRangeControl } from "../math/stats.js";
import { currentAiState } from "../state.js";

window.currentInsights = {};

export function addBulb(chartId, title, observation, tips) { 
    // Bulletproof array mapping
    const safeTips = Array.isArray(tips) ? tips : [tips];
    window.currentInsights[chartId] = { title, observation, tips: safeTips }; 
    
    const bulb = document.getElementById(`bulb-${chartId}`); 
    if (bulb) { bulb.classList.remove('hidden'); } 
}

export function runExpertAnalysis(ctx, dimName) { 
    const { Cp, Cpk, Pp, Ppk, overallMean, overallStDev, withinStDev, trend, isNormal, tolerance, subSize, subgroups, targetCpk, lsl, usl } = ctx; 
    const rangeControl = checkRangeControl(subgroups, subSize); 
    const isRangeStable = rangeControl.isStable; 
    
    // 1. Process Drift (Trend)
    if (Math.abs(trend) > 0.5) { 
        addBulb('spChart1', 'Process Drift Detected', 'Significant upward or downward trend in the process mean.', [
            'Ensure the mold has reached thermal equilibrium (thermal soak).', 
            'Check barrel temperature controllers for cycling/instability.', 
            'Verify hydraulic oil temperature stability.'
        ]); 
    } 
    
    // 2. Range Control (MR/R Chart Stability)
    if (!isRangeStable) { 
        addBulb('spChart1', 'Limits Suspect', 'Because the Range/Moving Range chart is out of control, the Control Limits on this chart are mathematically invalid.', [
            'Do not try to center the process yet.', 
            'Focus on fixing the variation issues flagged in the Range Chart below first.'
        ]); 
        addBulb('spChart2', 'Unstable Variation', 'Points exceed the Upper Control Limit (UCL), indicating special cause variation.', [
            'Check for material feed issues (bridging in throat).', 
            'Verify cushion consistency (if cushion varies, verify check ring function).', 
            'Check for inconsistent regrind usage.'
        ]); 
    } else if (rangeControl.hasZeros && subSize > 1) { 
        addBulb('spChart2', 'Resolution Warning', 'Multiple range points are zero. The gauge may not have enough resolution.', [
            'Use a gauge with at least 10x resolution of the tolerance.', 
            'Check if data was rounded heavily before import.'
        ]); 
    } 

    // 3. X-BAR CHART: Mathematical Limits Alert
    if (isRangeStable && Math.abs(trend) <= 0.5) {
        const sigmaX = withinStDev / Math.sqrt(subSize || 1);
        const uclX = overallMean + (3 * sigmaX);
        const lclX = overallMean - (3 * sigmaX);
        
        const oocX = subgroups.filter(g => g.mean > (uclX + 0.000001) || g.mean < (lclX - 0.000001));

        if (oocX.length > 0) {
            addBulb('spChart1', 'Stability Alert: X-Bar Chart', `Found ${oocX.length} points outside the 3-sigma control limits. This indicates the process mean is shifting or unstable.`, [
                "Check for a recent shift in the process average.",
                "Look for 'Special Cause' variation like a tool offset change or batch swap.",
                "Investigate if the machine was restarted or recalibrated recently."
            ]);
        }
    }

    // 4. R-CHART: Average Range Alert
    if (isRangeStable) {
        const avgRange = jStat.mean(subgroups.map(g => g.range !== undefined ? g.range : (g.mr || 0)));
        if (avgRange > (tolerance * 0.1)) {
            addBulb('spChart2', 'Variation Alert: R-Chart', 'The Range chart shows high within-subgroup variation relative to your tolerance.', [
                "Check for loose fixtures or inconsistent clamping.",
                "Look for thermal expansion issues during the run.",
                "Verify measurement consistency across different parts."
            ]);
        }
    }
    
    // 5. General Capability & Shift Logic
    if (Math.abs(Cpk - Ppk) > 0.5) { 
        addBulb('spChart3', 'Process Shift / Instability', 'Significant difference between Potential (Cpk) and Actual (Ppk) capability.', [
            'Look for distinct "layers" in the run chart (Stratification).', 
            'This often indicates mixing two different lots of material or cavities.', 
            'Check for periodic cycles (e.g. correlated to heater band cycling).'
        ]); 
    } 
    
    if (currentAiState.isMixedCavity) { 
        addBulb('spChart4', 'Mixed Population Risk', 'Histogram likely shows multiple peaks due to mixing cavities.', [
            'Analyze cavities separately to see true capability.', 
            'Mixing distributions artificially inflates standard deviation.'
        ]); 
    } 
    
    if (currentAiState.isBoundary) { 
        addBulb('spChart4', 'Truncated Distribution', 'Data is piled up near zero (Physical Boundary).', [
            'This is normal for Flatness, Runout, or Concentricity.', 
            'Do not attempt to center this bell curve.', 
            'Use Ppk (Percentile) for lot acceptance.'
        ]); 
    } 
    
    if (!isNormal && !currentAiState.isBoundary) { 
        addBulb('spChart5', 'Non-Normal Distribution', 'Data does not follow a straight line (Normal).', [
            'If the tail curves up or down, check for "Flyers" (Outliers).', 
            'S-Shape usually indicates mixed batches or cavities.', 
            'If P-value < 0.05, Cpk predictions may be inaccurate.'
        ]); 
    } 
    
    if (Cp < targetCpk) { 
        const severity = Cp < 1.0 ? "Critical" : "Marginal"; 
        const spreadPct = ((1/Cp) * 100).toFixed(0); 
        let tips = subSize === 1 ? [
            '<strong>Shot-to-Shot Instability:</strong> The machine cannot repeat the same shot.', 
            '<strong>Check Non-Return Valve:</strong> Worn check rings cause cushion variance.', 
            '<strong>Verify Cushion:</strong> If cushion is not stable, the part is not packed consistently.'
        ] : [
            '<strong>Process Spread:</strong> The variation is too high for the tolerance.', 
            '<strong>Gate Freeze:</strong> Perform a Gate Freeze study.', 
            '<strong>Clamp Tonnage:</strong> Ensure the mold isn\'t breathing (flashing).'
        ]; 
        
        addBulb('spChart6', `Consistency Issue (${severity})`, `The Process Spread uses ${spreadPct}% of the tolerance. (Target Cp > ${targetCpk}).`, [
            '<strong>Do Not Center Yet:</strong> Shifting the mean will not solve this. You must reduce the range of variation first.', 
            ...tips
        ]); 
        
        if(!window.currentInsights['spChart2']) { 
            addBulb('spChart2', 'Source of Width', 'The height of these bars represents the instability expanding your bell curve.', [
                'Lowering the average Range is the only way to improve Cp.'
            ]); 
        } 
    } else if (Cpk < targetCpk) { 
        const target = (tolerance / 2) + lsl; 
        const isOversize = overallMean > target; 
        const dimStatus = isOversize ? "Oversize (Mean > Nominal)" : "Undersize (Mean < Nominal)"; 
        let processActions = isOversize ? "<strong>To Lower Dims:</strong> Decrease Hold Pressure, Increase Cooling Time, or Lower Mold Temp." : "<strong>To Raise Dims:</strong> Increase Hold Pressure, Decrease Cooling Time, or Raise Mold Temp."; 
        
        addBulb('spChart6', 'The "Centering" Problem', `Process is consistent (Good Cp) but off-target (${dimStatus}).`, [
            '<strong>Shift the Mean:</strong> You need to move the dimension average towards the nominal value.', 
            processActions, 
            '<strong>Tooling Adjustments (Steel Safe?):</strong>', 
            '• If you need to make a hole larger (ID): You can <strong>cut steel</strong>.', 
            '• If you need to make a post/shaft larger (OD): You may need to <strong>weld</strong> or insert.'
        ]); 
    } 
}
