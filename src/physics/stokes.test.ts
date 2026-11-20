import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACTIVE_BALL,
  DEFAULT_ENVIRONMENT,
  DEFAULT_SAVED_READINGS,
  LIQUID_PRESETS,
  clampMarkPositions,
  computeBallResult,
  computeExperimentSummary,
  computeMarksForSpan,
  computeOriginRegression,
  computePredictedTimeS,
  computeTheoreticalVelocityMs,
  createActiveBallMeasurement,
  createSampleSavedReadings,
  createSavedReadingFromTrial,
  evaluateFallKinematics,
  getMarkBoundsMm,
  type LabEnvironment,
  type SavedReading,
} from './stokes';

test('1. Default configuration is Glycerin (20 °C) + Steel with single active ball and 4 valid sequential readings recovering 0.95 Pa·s', () => {
  assert.equal(DEFAULT_ENVIRONMENT.liquidPreset, 'glycerin');
  assert.equal(DEFAULT_ENVIRONMENT.liquidDensityKgM3, 1260);
  assert.equal(DEFAULT_ENVIRONMENT.referenceViscosityPas, 0.95);
  assert.equal(DEFAULT_ENVIRONMENT.ballDensityKgM3, 7800);
  assert.equal(DEFAULT_ENVIRONMENT.gravityMs2, 9.81);
  assert.equal(DEFAULT_SAVED_READINGS.length, 4);

  const activeRes = computeBallResult(DEFAULT_ACTIVE_BALL, DEFAULT_ENVIRONMENT);
  assert.equal(activeRes.reynoldsStatus, 'valid');
  assert.ok(activeRes.viscosityPas !== null && Math.abs(activeRes.viscosityPas - 0.95) < 0.002);

  const summary = computeExperimentSummary(DEFAULT_SAVED_READINGS, DEFAULT_ENVIRONMENT);
  assert.equal(summary.hasCriticalDensityError, false);
  assert.equal(summary.acceptedResults.length, 4);
  assert.equal(summary.excludedResults.length, 0);

  for (const r of summary.results) {
    assert.equal(r.reynoldsStatus, 'valid');
    assert.ok(r.reynoldsNumber !== null && r.reynoldsNumber < 0.5);
    assert.ok(r.viscosityPas !== null);
    assert.ok(Math.abs(r.viscosityPas - 0.95) < 0.002);
  }

  assert.ok(summary.averageViscosityPas !== null);
  assert.ok(Math.abs(summary.averageViscosityPas - 0.95) < 0.001);
  assert.ok(summary.graphDerivedViscosityPas !== null);
  assert.ok(Math.abs(summary.graphDerivedViscosityPas - 0.95) < 0.001);
  assert.ok(summary.graphRSquared !== null && summary.graphRSquared > 0.99999);
});

test('2. computeBallResult calculates exact Ladenburg corrections and Stokes viscosity for a single sphere', () => {
  const env: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    liquidDensityKgM3: 1260,
    ballDensityKgM3: 7800,
    cylinderDiameterMm: 50,
    columnHeightMm: 450,
    gravityMs2: 9.81,
  };

  const ball = { id: 1, label: 'Active Sphere', radiusMm: 2.0, lengthMm: 250, timeS: 5.0 };
  const res = computeBallResult(ball, env);

  assert.ok(Math.abs(res.observedVelocityMs - 0.05) < 1e-9);
  assert.ok(Math.abs(res.wallCorrectionF1 - 1.192) < 1e-9);

  const expectedF2 = 1 + (3.3 * 2) / 450;
  assert.ok(Math.abs(res.bottomCorrectionF2 - expectedF2) < 1e-9);

  const expectedCL = 1.192 * expectedF2;
  assert.ok(Math.abs(res.combinedCorrectionCL - expectedCL) < 1e-9);

  const expectedV = 0.05 * expectedCL;
  assert.ok(Math.abs(res.correctedVelocityMs - expectedV) < 1e-9);

  const expectedEta = (2 * (7800 - 1260) * 9.81 * (0.002 ** 2)) / (9 * expectedV);
  assert.ok(res.viscosityPas !== null);
  assert.ok(Math.abs(res.viscosityPas - expectedEta) < 1e-9);

  const expectedRe = (1260 * 0.004 * expectedV) / expectedEta;
  assert.ok(res.reynoldsNumber !== null);
  assert.ok(Math.abs(res.reynoldsNumber - expectedRe) < 1e-9);
  assert.equal(res.reynoldsStatus, 'valid');
});

test('3. Ball radius scaling: volume ~ r^3, v_th ~ r^2, predicted time decreases with r', () => {
  const v1 = computeTheoreticalVelocityMs(1.0, DEFAULT_ENVIRONMENT, 0.95)!;
  const v2 = computeTheoreticalVelocityMs(2.0, DEFAULT_ENVIRONMENT, 0.95)!;
  const v3 = computeTheoreticalVelocityMs(3.0, DEFAULT_ENVIRONMENT, 0.95)!;

  assert.ok(Math.abs(v2 / v1 - 4.0) < 1e-9);
  assert.ok(Math.abs(v3 / v1 - 9.0) < 1e-9);

  const t1 = computePredictedTimeS(1.0, 250, DEFAULT_ENVIRONMENT, 0.95)!;
  const t2 = computePredictedTimeS(2.0, 250, DEFAULT_ENVIRONMENT, 0.95)!;
  assert.ok(t2 < t1);

  const b1 = computeBallResult({ id: 1, label: 'R1', radiusMm: 1.0, lengthMm: 250, timeS: t1 }, DEFAULT_ENVIRONMENT);
  const b2 = computeBallResult({ id: 2, label: 'R2', radiusMm: 2.0, lengthMm: 250, timeS: t2 }, DEFAULT_ENVIRONMENT);
  assert.ok(Math.abs(b2.volumeM3 / b1.volumeM3 - 8.0) < 1e-9);
  assert.ok((b2.reynoldsNumber ?? 0) > (b1.reynoldsNumber ?? 0));
});

test('4. Ball density increase raises net settling force, v_th, and Re while shortening settling time', () => {
  const glassEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, ballDensityKgM3: 2500 };
  const tungstenEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, ballDensityKgM3: 15600 };

  const tGlass = computePredictedTimeS(1.5, 250, glassEnv, 0.95)!;
  const tTungsten = computePredictedTimeS(1.5, 250, tungstenEnv, 0.95)!;
  assert.ok(tTungsten < tGlass);

  const rGlass = computeBallResult({ id: 1, label: 'Glass', radiusMm: 1.5, lengthMm: 250, timeS: tGlass }, glassEnv);
  const rTungsten = computeBallResult({ id: 1, label: 'Tungsten', radiusMm: 1.5, lengthMm: 250, timeS: tTungsten }, tungstenEnv);

  assert.ok(rTungsten.netSettlingForceN > rGlass.netSettlingForceN);
  assert.ok((rTungsten.theoreticalVelocityMs ?? 0) > (rGlass.theoreticalVelocityMs ?? 0));
  assert.ok((rTungsten.reynoldsNumber ?? 0) > (rGlass.reynoldsNumber ?? 0));
});

test('5. Liquid density increase (while < rho_b) reduces net force and v_th and increases settling time', () => {
  const lowRhoEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, liquidDensityKgM3: 900 };
  const highRhoEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, liquidDensityKgM3: 1400 };

  const vLow = computeTheoreticalVelocityMs(1.5, lowRhoEnv, 0.95)!;
  const vHigh = computeTheoreticalVelocityMs(1.5, highRhoEnv, 0.95)!;
  assert.ok(vHigh < vLow);

  const tLow = computePredictedTimeS(1.5, 250, lowRhoEnv, 0.95)!;
  const tHigh = computePredictedTimeS(1.5, 250, highRhoEnv, 0.95)!;
  assert.ok(tHigh > tLow);
});

test('6. Viscosity increase lowers terminal velocity (~ 1/eta), lengthens settling time, and lowers Re', () => {
  const vLowEta = computeTheoreticalVelocityMs(1.5, DEFAULT_ENVIRONMENT, 0.5)!;
  const vHighEta = computeTheoreticalVelocityMs(1.5, DEFAULT_ENVIRONMENT, 2.0)!;
  assert.ok(Math.abs(vLowEta / vHighEta - 4.0) < 1e-9);

  const tLowEta = computePredictedTimeS(1.5, 250, DEFAULT_ENVIRONMENT, 0.5)!;
  const tHighEta = computePredictedTimeS(1.5, 250, DEFAULT_ENVIRONMENT, 2.0)!;
  assert.ok(Math.abs(tHighEta / tLowEta - 4.0) < 1e-9);
});

test('7. Gravity increase raises terminal velocity (~ g) and decreases settling time (~ 1/g)', () => {
  const moonEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, gravityMs2: 1.62 };
  const earthEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, gravityMs2: 9.81 };

  const vMoon = computeTheoreticalVelocityMs(1.5, moonEnv, 0.95)!;
  const vEarth = computeTheoreticalVelocityMs(1.5, earthEnv, 0.95)!;
  assert.ok(Math.abs(vEarth / vMoon - 9.81 / 1.62) < 1e-9);

  const tMoon = computePredictedTimeS(1.5, 250, moonEnv, 0.95)!;
  const tEarth = computePredictedTimeS(1.5, 250, earthEnv, 0.95)!;
  assert.ok(Math.abs(tMoon / tEarth - 9.81 / 1.62) < 1e-9);
});

test('8. Cylinder geometry and Ladenburg corrections respond to D, H, L and reject 2r >= D', () => {
  const narrowEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, cylinderDiameterMm: 20, columnHeightMm: 200 };
  const wideEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, cylinderDiameterMm: 100, columnHeightMm: 600 };
  const ball = { id: 1, label: 'Active Sphere', radiusMm: 2.0, lengthMm: 250, timeS: 5.0 };

  const resNarrow = computeBallResult(ball, narrowEnv);
  const resWide = computeBallResult(ball, wideEnv);
  assert.ok(resNarrow.wallCorrectionF1 > resWide.wallCorrectionF1);
  assert.ok(resNarrow.bottomCorrectionF2 > resWide.bottomCorrectionF2);
  assert.ok(resNarrow.combinedCorrectionCL > resWide.combinedCorrectionCL);
  assert.ok(resNarrow.warnings.some((w) => w.includes('exceeds liquid column height')));

  const tooBigBall = { id: 1, label: 'Too Big', radiusMm: 10.0, lengthMm: 250, timeS: 5.0 };
  const resTooBig = computeBallResult(tooBigBall, narrowEnv);
  assert.ok(resTooBig.validationErrors.length > 0);
  assert.equal(resTooBig.isStokesAccepted, false);
  assert.equal(computePredictedTimeS(10.0, 250, narrowEnv, 0.95), null);
});

test('9. Neutral buoyancy (rho_b == rho_l) produces zero net settling force and non-settling state', () => {
  const neutralEnv: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    liquidDensityKgM3: 1260,
    ballDensityKgM3: 1260,
  };
  const res = computeBallResult(DEFAULT_ACTIVE_BALL, neutralEnv);
  assert.equal(res.buoyancyCondition, 'neutral');
  assert.equal(res.netSettlingPossible, false);
  assert.equal(res.netSettlingForceN, 0);
  assert.equal(res.viscosityPas, null);
  assert.equal(res.isStokesAccepted, false);
  assert.equal(computePredictedTimeS(1.5, 250, neutralEnv, 0.95), null);

  const summary = computeExperimentSummary(
    [createSavedReadingFromTrial(DEFAULT_ACTIVE_BALL, neutralEnv, 1, 1)],
    neutralEnv,
  );
  assert.equal(summary.hasCriticalDensityError, true);
  assert.equal(summary.averageViscosityPas, null);

  const kin = evaluateFallKinematics({
    timeS: 1.0,
    radiusM: 0.0015,
    ballDensityKgM3: 1260,
    liquidDensityKgM3: 1260,
    gravityMs2: 9.81,
    terminalObservedVelocityMs: 0,
    effectiveViscosityPas: 0.95,
    totalTravelM: 0.35,
  });
  assert.equal(kin.buoyancyCondition, 'neutral');
  assert.equal(kin.phase, 'floating');
  assert.equal(kin.velocityMs, 0);
  assert.equal(kin.dragForceN, 0);
  assert.equal(kin.progressFraction, 0.5);
});

test('10. Floating sphere (rho_b < rho_l) is flagged as floating with zero settling', () => {
  const floatingEnv: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    liquidDensityKgM3: 1260,
    ballDensityKgM3: 650,
  };
  const res = computeBallResult(DEFAULT_ACTIVE_BALL, floatingEnv);
  assert.equal(res.buoyancyCondition, 'floating');
  assert.equal(res.netSettlingPossible, false);
  assert.ok(res.netSettlingForceN < 0);
  assert.equal(res.viscosityPas, null);
  assert.equal(res.isStokesAccepted, false);

  const readings = createSampleSavedReadings(floatingEnv, [1.0, 1.5], 0.95);
  const summary = computeExperimentSummary(readings, floatingEnv);
  assert.equal(summary.hasCriticalDensityError, true);
  assert.equal(summary.averageViscosityPas, null);
  assert.equal(summary.graphDerivedViscosityPas, null);

  const kin = evaluateFallKinematics({
    timeS: 1.0,
    radiusM: 0.0015,
    ballDensityKgM3: 650,
    liquidDensityKgM3: 1260,
    gravityMs2: 9.81,
    terminalObservedVelocityMs: 0,
    effectiveViscosityPas: 0.95,
    totalTravelM: 0.35,
  });
  assert.equal(kin.buoyancyCondition, 'floating');
  assert.equal(kin.phase, 'floating');
  assert.equal(kin.velocityMs, 0);
  assert.equal(kin.progressFraction, 0);
});

test('11. Reynolds regimes classify valid/caution/invalid and strictly exclude Re >= 1.0 from mean eta and regression', () => {
  const valid1 = createSavedReadingFromTrial(
    createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.0, 250, 0.95),
    DEFAULT_ENVIRONMENT,
    1,
    1,
  );
  const valid2 = createSavedReadingFromTrial(
    createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.8, 250, 0.95),
    DEFAULT_ENVIRONMENT,
    2,
    2,
  );
  const cautionBall = createSavedReadingFromTrial(
    createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 2.5, 250, 0.95),
    DEFAULT_ENVIRONMENT,
    3,
    3,
  );
  const invalidBall = createSavedReadingFromTrial(
    { id: 4, label: 'Reading #4', radiusMm: 4.0, lengthMm: 250, timeS: 0.4 },
    DEFAULT_ENVIRONMENT,
    4,
    4,
  );

  const cRes = computeBallResult(cautionBall, DEFAULT_ENVIRONMENT);
  assert.equal(cRes.reynoldsStatus, 'caution');
  assert.equal(cRes.isStokesAccepted, true);

  const iRes = computeBallResult(invalidBall, DEFAULT_ENVIRONMENT);
  assert.equal(iRes.reynoldsStatus, 'invalid');
  assert.equal(iRes.isStokesAccepted, false);
  assert.ok(iRes.exclusionReason !== null);

  const summary = computeExperimentSummary([valid1, valid2, cautionBall, invalidBall], DEFAULT_ENVIRONMENT);
  assert.equal(summary.acceptedResults.length, 3);
  assert.equal(summary.cautionResults.length, 1);
  assert.equal(summary.excludedResults.length, 1);

  assert.ok(summary.averageViscosityPas !== null);
  assert.ok(Math.abs(summary.averageViscosityPas - 0.95) < 0.002);
  assert.ok(summary.graphDerivedViscosityPas !== null);
  assert.ok(Math.abs(summary.graphDerivedViscosityPas - 0.95) < 0.002);
});

test('12. Origin regression handles 0, 1, and >=2 points cleanly and flags insufficient data', () => {
  assert.deepEqual(computeOriginRegression([]), { slope: null, rSquared: null, hasDistinctX: false });

  const single = computeOriginRegression([{ x: 2, y: 6 }]);
  assert.equal(single.slope, 3);
  assert.equal(single.rSquared, null);

  const multi = computeOriginRegression([
    { x: 1, y: 2 },
    { x: 2, y: 4 },
    { x: 3, y: 6 },
  ]);
  assert.equal(multi.slope, 2);
  assert.equal(multi.rSquared, 1);

  const emptySummary = computeExperimentSummary([], DEFAULT_ENVIRONMENT);
  assert.equal(emptySummary.results.length, 0);
  assert.equal(emptySummary.regressionInsufficientData, true);
  assert.equal(emptySummary.averageViscosityPas, null);
  assert.equal(emptySummary.graphRSquared, null);

  const singleSummary = computeExperimentSummary([DEFAULT_SAVED_READINGS[0]], DEFAULT_ENVIRONMENT);
  assert.equal(singleSummary.results.length, 1);
  assert.equal(singleSummary.regressionInsufficientData, true);
  assert.equal(singleSummary.graphRSquared, null);
  assert.ok(singleSummary.averageViscosityPas !== null);
});

test('13. Sequential single-ball readings accumulate cleanly from 0 -> 1 -> 2 -> 3 trials and reset on clear', () => {
  const dataset: SavedReading[] = [];
  assert.equal(computeExperimentSummary(dataset, DEFAULT_ENVIRONMENT).results.length, 0);

  const r1 = createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.0, 250, 0.95);
  dataset.push(createSavedReadingFromTrial(r1, DEFAULT_ENVIRONMENT, 1, 101));
  const s1 = computeExperimentSummary(dataset, DEFAULT_ENVIRONMENT);
  assert.equal(s1.acceptedResults.length, 1);
  assert.equal(s1.graphRSquared, null);

  const r2 = createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.5, 250, 0.95);
  dataset.push(createSavedReadingFromTrial(r2, DEFAULT_ENVIRONMENT, 2, 102));
  const s2 = computeExperimentSummary(dataset, DEFAULT_ENVIRONMENT);
  assert.equal(s2.acceptedResults.length, 2);
  assert.ok(s2.graphRSquared !== null && s2.graphRSquared > 0.99999);

  const r3 = createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 2.0, 250, 0.95);
  dataset.push(createSavedReadingFromTrial(r3, DEFAULT_ENVIRONMENT, 3, 103));
  const s3 = computeExperimentSummary(dataset, DEFAULT_ENVIRONMENT);
  assert.equal(s3.acceptedResults.length, 3);
  assert.ok(Math.abs((s3.graphDerivedViscosityPas ?? 0) - 0.95) < 0.001);
});

test('14. Auto experimental viscosity mode overrides reference viscosity for theoretical predictions', () => {
  const customReadings = DEFAULT_SAVED_READINGS.map((b) => ({ ...b, timeS: b.timeS * 2 }));
  const manualEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, useAutoExperimentalViscosity: false };
  const autoEnv: LabEnvironment = { ...DEFAULT_ENVIRONMENT, useAutoExperimentalViscosity: true };

  const manualSum = computeExperimentSummary(customReadings, manualEnv);
  const autoSum = computeExperimentSummary(customReadings, autoEnv);

  assert.ok(Math.abs((autoSum.averageViscosityPas ?? 0) - 1.9) < 0.01);
  assert.ok(Math.abs((manualSum.activeTheoreticalViscosityPas ?? 0) - 0.95) < 1e-6);
  assert.ok(Math.abs((autoSum.activeTheoreticalViscosityPas ?? 0) - 1.9) < 0.01);
  assert.ok(
    (manualSum.results[0].theoreticalVelocityMs ?? 0) >
      (autoSum.results[0].theoreticalVelocityMs ?? 0) * 1.9,
  );
});

test('15. evaluateFallKinematics starts at rest, ramps smoothly, reaches equilibrium, and stops at floor', () => {
  const common = {
    radiusM: 0.0018,
    ballDensityKgM3: 7800,
    liquidDensityKgM3: 1260,
    gravityMs2: 9.81,
    terminalObservedVelocityMs: 0.04,
    effectiveViscosityPas: 0.95,
    totalTravelM: 0.378,
    pedagogicalRamp: true,
  };

  const t0 = evaluateFallKinematics({ ...common, timeS: 0 });
  assert.equal(t0.velocityMs, 0);
  assert.equal(t0.dragForceN, 0);
  assert.equal(t0.phase, 'ready');
  assert.equal(t0.isPedagogicalRampUsed, true);

  const tMid = evaluateFallKinematics({ ...common, timeS: 0.25 });
  assert.equal(tMid.phase, 'accelerating');
  assert.ok(tMid.velocityMs > 0 && tMid.velocityMs < 0.04);
  assert.ok(tMid.dragForceN > 0 && tMid.dragForceN < tMid.weightForceN - tMid.buoyancyForceN);

  const tSteady = evaluateFallKinematics({ ...common, timeS: 3.0 });
  assert.equal(tSteady.phase, 'terminal');
  assert.ok(Math.abs(tSteady.velocityMs - 0.04) < 0.001);
  assert.ok(Math.abs(tSteady.buoyancyForceN + tSteady.dragForceN - tSteady.weightForceN) < 1e-6);

  const tEnd = evaluateFallKinematics({ ...common, timeS: 20.0 });
  assert.equal(tEnd.phase, 'completed');
  assert.equal(tEnd.progressFraction, 1);
  assert.equal(tEnd.velocityMs, 0);

  const tPhys = evaluateFallKinematics({ ...common, timeS: 0.2, pedagogicalRamp: false });
  assert.equal(tPhys.isPedagogicalRampUsed, false);
  assert.ok(tPhys.tauPhysS < 0.02);
  assert.equal(tPhys.phase, 'terminal');
});

test('16. Preset switching (Water vs Honey) produces accurate Reynolds exclusion vs valid creeping flow', () => {
  const water = LIQUID_PRESETS.find((l) => l.id === 'water')!;
  const honey = LIQUID_PRESETS.find((l) => l.id === 'honey')!;

  const waterEnv: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    liquidPreset: 'water',
    liquidDensityKgM3: water.densityKgM3,
    referenceViscosityPas: water.referenceViscosityPas,
  };
  const waterReadings = createSampleSavedReadings(waterEnv, [1.0, 1.4, 1.8, 2.2], water.referenceViscosityPas);
  const waterSum = computeExperimentSummary(waterReadings, waterEnv);
  assert.equal(waterSum.excludedResults.length, 4);
  assert.equal(waterSum.acceptedResults.length, 0);
  assert.equal(waterSum.averageViscosityPas, null);

  const honeyEnv: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    liquidPreset: 'honey',
    liquidDensityKgM3: honey.densityKgM3,
    referenceViscosityPas: honey.referenceViscosityPas,
  };
  const honeyReadings = createSampleSavedReadings(honeyEnv, [1.0, 1.4, 1.8, 2.2], honey.referenceViscosityPas);
  const honeySum = computeExperimentSummary(honeyReadings, honeyEnv);
  assert.equal(honeySum.acceptedResults.length, 4);
  assert.equal(honeySum.excludedResults.length, 0);
  assert.ok(Math.abs((honeySum.averageViscosityPas ?? 0) - 5.0) < 0.005);
});

test('17. R² edge cases: identical radii yield null (same_radius); constant horizontal y yields R² = 0; collinear origin line yields R² = 1', () => {
  const sameRadiusReg = computeOriginRegression([
    { x: 1.96, y: 0.025 },
    { x: 1.96, y: 0.026 },
  ]);
  assert.equal(sameRadiusReg.hasDistinctX, false);
  assert.equal(sameRadiusReg.rSquared, null);

  const flatHorizontalReg = computeOriginRegression([
    { x: 1, y: 5 },
    { x: 2, y: 5 },
    { x: 4, y: 5 },
  ]);
  assert.equal(flatHorizontalReg.hasDistinctX, true);
  assert.equal(flatHorizontalReg.rSquared, 0);

  const sameRadiusSummary = computeExperimentSummary(
    [
      createSavedReadingFromTrial(createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.4, 250, 0.95), DEFAULT_ENVIRONMENT, 1, 201),
      createSavedReadingFromTrial(createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.4, 250, 0.98), DEFAULT_ENVIRONMENT, 2, 202),
    ],
    DEFAULT_ENVIRONMENT,
  );
  assert.equal(sameRadiusSummary.rSquaredStatus, 'same_radius');
  assert.equal(sameRadiusSummary.graphRSquared, null);
  assert.equal(sameRadiusSummary.regressionInsufficientData, true);
  assert.ok(sameRadiusSummary.averageViscosityPas !== null);
});

test('18. Mixed medium and mixed fluid readings disable pooled regression while preserving per-reading η and reference velocity', () => {
  const honey = LIQUID_PRESETS.find((l) => l.id === 'honey')!;
  const honeyEnv: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    liquidPreset: 'honey',
    liquidDensityKgM3: honey.densityKgM3,
    referenceViscosityPas: honey.referenceViscosityPas,
  };

  const glycReading = createSavedReadingFromTrial(
    createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.4, 250, 0.95),
    DEFAULT_ENVIRONMENT,
    1,
    301,
  );
  const honeyReading = createSavedReadingFromTrial(
    createActiveBallMeasurement(honeyEnv, 2.0, 250, 5.0),
    honeyEnv,
    2,
    302,
  );

  // Evaluate mixed dataset while active UI is set to Honey
  const mixedFluidSum = computeExperimentSummary([glycReading, honeyReading], honeyEnv);
  assert.equal(mixedFluidSum.hasMixedFluidConditions, true);
  assert.equal(mixedFluidSum.hasMixedMediumConditions, true);
  assert.equal(mixedFluidSum.rSquaredStatus, 'mixed_conditions');
  assert.equal(mixedFluidSum.graphSlopePerMS, null);
  assert.equal(mixedFluidSum.graphRSquared, null);
  assert.equal(mixedFluidSum.graphDerivedViscosityPas, null);
  assert.equal(mixedFluidSum.averageViscosityPas, null);
  assert.equal(mixedFluidSum.validViscosityCount, 0);

  // Per-reading viscosity and theoretical velocity retain each reading's own fluid snapshot
  assert.ok(Math.abs((mixedFluidSum.results[0].viscosityPas ?? 0) - 0.95) < 0.002);
  assert.ok(Math.abs((mixedFluidSum.results[1].viscosityPas ?? 0) - 5.0) < 0.005);
  assert.ok(
    Math.abs(
      (mixedFluidSum.results[0].theoreticalVelocityMs ?? 0) -
        mixedFluidSum.results[0].correctedVelocityMs,
    ) < 1e-4,
  );

  // Same liquid, different ball density (Steel vs Aluminum) -> averageViscosityPas still valid, but regression disabled
  const aluEnv: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    ballMaterial: 'aluminum',
    ballDensityKgM3: 2700,
  };
  const aluReading = createSavedReadingFromTrial(
    createActiveBallMeasurement(aluEnv, 2.0, 250, 0.95),
    aluEnv,
    3,
    303,
  );
  const mixedBallSum = computeExperimentSummary([glycReading, aluReading], DEFAULT_ENVIRONMENT);
  assert.equal(mixedBallSum.hasMixedFluidConditions, false);
  assert.equal(mixedBallSum.hasMixedMediumConditions, true);
  assert.equal(mixedBallSum.rSquaredStatus, 'mixed_conditions');
  assert.equal(mixedBallSum.graphRSquared, null);
  assert.ok(Math.abs((mixedBallSum.averageViscosityPas ?? 0) - 0.95) < 0.002);
});

test('19. Water density changes & sub-10ms precision and Ladenburg wall/end (D, H) corrections accurately recover viscosity', () => {
  const water = LIQUID_PRESETS.find((l) => l.id === 'water')!;
  const waterEnv1000: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    liquidPreset: 'water',
    liquidDensityKgM3: water.densityKgM3,
    referenceViscosityPas: water.referenceViscosityPas,
  };
  const waterEnv1300: LabEnvironment = {
    ...waterEnv1000,
    liquidPreset: 'custom',
    liquidDensityKgM3: 1300,
  };

  const active1000 = createActiveBallMeasurement(waterEnv1000, 1.4, 250, water.referenceViscosityPas);
  const active1300 = createActiveBallMeasurement(waterEnv1300, 1.4, 250, water.referenceViscosityPas);
  assert.ok(active1000.timeS < 0.015);
  assert.ok(active1300.timeS > active1000.timeS);

  const res1000 = computeBallResult(active1000, waterEnv1000);
  const res1300 = computeBallResult(active1300, waterEnv1300);
  assert.ok(Math.abs((res1000.viscosityPas ?? 0) - 0.001002) < 1e-6);
  assert.ok(Math.abs((res1300.viscosityPas ?? 0) - 0.001002) < 1e-6);

  // Wall & end correction (D = 50 -> 20 mm, H = 450 -> 150 mm)
  const narrowEnv: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    cylinderDiameterMm: 20,
    columnHeightMm: 150,
  };
  const narrowSample = createSampleSavedReadings(narrowEnv, [1.0, 1.4, 1.8, 2.2], 0.95);
  const narrowSum = computeExperimentSummary(narrowSample, narrowEnv);
  assert.ok(narrowSum.results[1].wallCorrectionF1 > 1.3);
  assert.ok(narrowSum.results[1].bottomCorrectionF2 > 1.03);
  assert.ok(Math.abs((narrowSum.averageViscosityPas ?? 0) - 0.95) < 0.002);
  assert.ok(Math.abs((narrowSum.graphDerivedViscosityPas ?? 0) - 0.95) < 0.002);
});

test('20. Auto-viscosity synchronization falls back cleanly when mixed fluids make averageViscosityPas null', () => {
  const honey = LIQUID_PRESETS.find((l) => l.id === 'honey')!;
  const honeyEnv: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    liquidPreset: 'honey',
    liquidDensityKgM3: honey.densityKgM3,
    referenceViscosityPas: honey.referenceViscosityPas,
    useAutoExperimentalViscosity: true,
  };

  const glycReading = createSavedReadingFromTrial(
    createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.4, 250, 0.95),
    DEFAULT_ENVIRONMENT,
    1,
    401,
  );
  const honeyReading = createSavedReadingFromTrial(
    createActiveBallMeasurement(honeyEnv, 2.0, 250, 5.0),
    honeyEnv,
    2,
    402,
  );

  const sum = computeExperimentSummary([glycReading, honeyReading], honeyEnv);
  assert.equal(sum.averageViscosityPas, null);
  assert.equal(sum.activeTheoreticalViscosityPas, 5.0);
});

test('21. Mark A and Mark B bounds, clamping, and target span alignment stay within column height H', () => {
  const bounds450 = getMarkBoundsMm(450);
  assert.equal(bounds450.minTopMm, 20);
  assert.equal(bounds450.maxBottomMm, 430);
  assert.equal(bounds450.minSpanMm, 10);

  // Moving A past B pushes B forward (up to maxBottomMm) while maintaining minSpanMm
  const pushB = clampMarkPositions({ markAMm: 325, markBMm: 330, columnHeightMm: 450, changed: 'A' });
  assert.equal(pushB.markAMm, 325);
  assert.equal(pushB.markBMm, 335);
  assert.equal(pushB.spanMm, 10);

  // Moving B above A pushes A upward while maintaining minSpanMm
  const pushA = clampMarkPositions({ markAMm: 80, markBMm: 84, columnHeightMm: 450, changed: 'B' });
  assert.equal(pushA.markBMm, 84);
  assert.equal(pushA.markAMm, 74);
  assert.equal(pushA.spanMm, 10);

  // Shrinking column height H clamps marks inside safe top/bottom bounds
  const shrunk = clampMarkPositions({ markAMm: 80, markBMm: 330, columnHeightMm: 200, changed: 'H' });
  assert.equal(shrunk.markAMm, 80);
  assert.equal(shrunk.markBMm, 180);
  assert.equal(shrunk.spanMm, 100);

  // computeMarksForSpan shifts Mark A upward when span exceeds remaining space below Mark A
  const spanFit = computeMarksForSpan({ markAMm: 300, targetSpanMm: 250, columnHeightMm: 450 });
  assert.equal(spanFit.markBMm, 430);
  assert.equal(spanFit.markAMm, 180);
  assert.equal(spanFit.spanMm, 250);
});

test('22. Moving Mark A / Mark B updates L = B - A, predicted T, manual-T v and eta, and saved dataset readings', () => {
  // Auto-synced mode: moving Mark A from 80 to 130 (with B = 330) shrinks L from 250 mm to 200 mm -> T scales by 0.8 while eta stays 0.95 Pa·s
  const shifted = clampMarkPositions({ markAMm: 130, markBMm: 330, columnHeightMm: 450, changed: 'A' });
  assert.equal(shifted.spanMm, 200);

  const env200: LabEnvironment = {
    ...DEFAULT_ENVIRONMENT,
    markAMm: shifted.markAMm,
    markBMm: shifted.markBMm,
    defaultMarkDistanceMm: shifted.spanMm,
  };

  const active250 = createActiveBallMeasurement(DEFAULT_ENVIRONMENT, 1.4, 250, 0.95);
  const active200 = createActiveBallMeasurement(env200, 1.4, shifted.spanMm, 0.95);
  assert.ok(Math.abs(active200.timeS / active250.timeS - 0.8) < 1e-3);

  const res200 = computeBallResult(active200, env200);
  assert.ok(Math.abs((res200.viscosityPas ?? 0) - 0.95) < 0.002);

  // Sample dataset rows also reflect updated L, markAMm, markBMm, and T
  const readings200 = createSampleSavedReadings(env200, [1.0, 1.4, 1.8, 2.2], 0.95);
  assert.equal(readings200.length, 4);
  for (let i = 0; i < readings200.length; i++) {
    assert.equal(readings200[i].markAMm, 130);
    assert.equal(readings200[i].markBMm, 330);
    assert.equal(readings200[i].lengthMm, 200);
    assert.ok(readings200[i].timeS < DEFAULT_SAVED_READINGS[i].timeS);
  }
  const sum200 = computeExperimentSummary(readings200, env200);
  assert.ok(Math.abs((sum200.averageViscosityPas ?? 0) - 0.95) < 0.001);

  // Manual T mode: holding stopwatch T fixed while increasing Mark B (larger L) increases v' = L/T, v, and lowers calculated eta
  const manualRes250 = computeBallResult({ ...active250, lengthMm: 250, timeS: 9.74 }, DEFAULT_ENVIRONMENT);
  const manualRes300 = computeBallResult({ ...active250, lengthMm: 300, timeS: 9.74 }, env200);
  assert.ok(manualRes300.observedVelocityMs > manualRes250.observedVelocityMs);
  assert.ok(manualRes300.correctedVelocityMs > manualRes250.correctedVelocityMs);
  assert.ok((manualRes300.viscosityPas ?? 0) < (manualRes250.viscosityPas ?? 0));
});

