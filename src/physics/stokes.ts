export type LiquidPresetId =
  | 'water'
  | 'glycerin'
  | 'castor_oil'
  | 'silicone_oil'
  | 'olive_oil'
  | 'honey'
  | 'custom';

export type BallMaterialId =
  | 'steel'
  | 'brass'
  | 'tungsten'
  | 'aluminum'
  | 'glass'
  | 'acrylic'
  | 'cork'
  | 'custom';

export interface LiquidPreset {
  id: LiquidPresetId;
  name: string;
  densityKgM3: number;
  referenceViscosityPas: number;
  colorHex: string;
  opacity: number;
  note: string;
}

export interface BallMaterialPreset {
  id: BallMaterialId;
  name: string;
  densityKgM3: number;
  colorHex: string;
  metalness: number;
  roughness: number;
}

export interface LabEnvironment {
  liquidPreset: LiquidPresetId;
  liquidDensityKgM3: number;
  referenceViscosityPas: number;
  useAutoExperimentalViscosity: boolean;
  ballMaterial: BallMaterialId;
  ballDensityKgM3: number;
  cylinderDiameterMm: number;
  columnHeightMm: number;
  markAMm?: number;
  markBMm?: number;
  defaultMarkDistanceMm: number;
  gravityMs2: number;
}

export interface BallMeasurement {
  id: number;
  label: string;
  radiusMm: number;
  lengthMm: number;
  timeS: number;
}

export interface SavedReading extends BallMeasurement {
  trialNumber: number;
  markAMm?: number;
  markBMm?: number;
  ballDensityKgM3: number;
  liquidDensityKgM3: number;
  cylinderDiameterMm: number;
  columnHeightMm: number;
  gravityMs2: number;
  liquidPreset: LiquidPresetId;
  liquidName: string;
  ballMaterialName: string;
  referenceViscosityPas?: number;
}

export interface BallCalculationResult {
  id: number;
  label: string;
  radiusMm: number;
  radiusM: number;
  radiusSqMm2: number;
  radiusSqM2: number;
  lengthMm: number;
  lengthM: number;
  timeS: number;
  cylinderRadiusM: number;
  columnHeightM: number;
  observedVelocityMs: number;
  wallCorrectionF1: number;
  bottomCorrectionF2: number;
  combinedCorrectionCL: number;
  correctedVelocityMs: number;
  theoreticalVelocityMs: number | null;
  theoreticalObservedVelocityMs: number | null;
  viscosityPas: number | null;
  reynoldsNumber: number | null;
  reynoldsStatus: 'valid' | 'caution' | 'invalid' | 'unavailable';
  isStokesAccepted: boolean;
  exclusionReason: string | null;
  buoyancyCondition: 'sinking' | 'neutral' | 'floating' | 'invalid';
  volumeM3: number;
  weightForceN: number;
  buoyancyForceN: number;
  netSettlingForceN: number;
  terminalDragForceN: number;
  netSettlingPossible: boolean;
  validationErrors: string[];
  warnings: string[];
}

export type RSquaredStatus =
  | 'valid'
  | 'insufficient_points'
  | 'same_radius'
  | 'mixed_conditions';

export interface ExperimentSummary {
  results: BallCalculationResult[];
  acceptedResults: BallCalculationResult[];
  cautionResults: BallCalculationResult[];
  excludedResults: BallCalculationResult[];
  validViscosityCount: number;
  averageViscosityPas: number | null;
  graphSlopePerMS: number | null;
  graphSlopeDisplayMm2PerS: number | null;
  graphRSquared: number | null;
  rSquaredStatus: RSquaredStatus;
  graphDerivedViscosityPas: number | null;
  observedGraphSlopePerMS: number | null;
  observedGraphRSquared: number | null;
  viscosityDiscrepancyPct: number | null;
  discrepancyVsReferencePct: number | null;
  activeTheoreticalViscosityPas: number | null;
  hasCriticalDensityError: boolean;
  hasMixedMediumConditions: boolean;
  hasMixedFluidConditions: boolean;
  regressionInsufficientData: boolean;
  globalWarnings: string[];
}

export interface FallKinematicsState {
  timeS: number;
  displacementM: number;
  velocityMs: number;
  accelerationMs2: number;
  terminalVelocityMs: number;
  dragForceN: number;
  buoyancyForceN: number;
  weightForceN: number;
  netGravityForceN: number;
  buoyancyCondition: 'sinking' | 'neutral' | 'floating';
  phase: 'ready' | 'accelerating' | 'terminal' | 'floating' | 'completed';
  progressFraction: number;
  tauPhysS: number;
  tauEffectiveS: number;
  isPedagogicalRampUsed: boolean;
}

export const LIQUID_PRESETS: LiquidPreset[] = [
  {
    id: 'glycerin',
    name: 'Glycerin (20 °C)',
    densityKgM3: 1260,
    referenceViscosityPas: 0.95,
    colorHex: '#f59e0b',
    opacity: 0.44,
    note: 'Standard college laboratory fluid for Stokes’ Law (low Re, smooth creeping terminal velocity).',
  },
  {
    id: 'water',
    name: 'Water (20 °C)',
    densityKgM3: 1000,
    referenceViscosityPas: 0.001002,
    colorHex: '#38bdf8',
    opacity: 0.32,
    note: 'Very low viscosity (~0.001002 Pa·s); millimeter steel spheres rapidly exceed Re = 1 and leave the Stokes regime.',
  },
  {
    id: 'castor_oil',
    name: 'Castor Oil (20 °C)',
    densityKgM3: 961,
    referenceViscosityPas: 0.986,
    colorHex: '#eab308',
    opacity: 0.42,
    note: 'High-viscosity vegetable oil ideal for millimeter steel sphere experiments.',
  },
  {
    id: 'silicone_oil',
    name: 'Silicone Oil (350 cSt)',
    densityKgM3: 970,
    referenceViscosityPas: 0.34,
    colorHex: '#60a5fa',
    opacity: 0.36,
    note: 'Calibration-grade Newtonian silicone fluid.',
  },
  {
    id: 'olive_oil',
    name: 'Olive Oil (20 °C)',
    densityKgM3: 918,
    referenceViscosityPas: 0.084,
    colorHex: '#a3e635',
    opacity: 0.40,
    note: 'Moderate-viscosity oil; requires small radii (r ≤ 1 mm) to stay below Re = 1.',
  },
  {
    id: 'honey',
    name: 'Clear Honey (25 °C)',
    densityKgM3: 1420,
    referenceViscosityPas: 5.0,
    colorHex: '#d97706',
    opacity: 0.56,
    note: 'Very high viscosity medium; ultra-slow creeping terminal fall.',
  },
];

export const BALL_MATERIAL_PRESETS: BallMaterialPreset[] = [
  {
    id: 'steel',
    name: 'Stainless / Carbon Steel',
    densityKgM3: 7800,
    colorHex: '#cbd5e1',
    metalness: 0.92,
    roughness: 0.16,
  },
  {
    id: 'brass',
    name: 'Brass',
    densityKgM3: 8500,
    colorHex: '#eab308',
    metalness: 0.9,
    roughness: 0.22,
  },
  {
    id: 'tungsten',
    name: 'Tungsten Carbide',
    densityKgM3: 15600,
    colorHex: '#64748b',
    metalness: 0.95,
    roughness: 0.18,
  },
  {
    id: 'aluminum',
    name: 'Aluminum Alloy',
    densityKgM3: 2700,
    colorHex: '#e2e8f0',
    metalness: 0.85,
    roughness: 0.25,
  },
  {
    id: 'glass',
    name: 'Borosilicate Glass Bead',
    densityKgM3: 2500,
    colorHex: '#bae6fd',
    metalness: 0.18,
    roughness: 0.08,
  },
  {
    id: 'acrylic',
    name: 'Acrylic Sphere',
    densityKgM3: 1180,
    colorHex: '#f472b6',
    metalness: 0.1,
    roughness: 0.25,
  },
  {
    id: 'cork',
    name: 'Light Polymer / Cork (Buoyant Test)',
    densityKgM3: 650,
    colorHex: '#d6b48c',
    metalness: 0.05,
    roughness: 0.78,
  },
];

export const RADIUS_PRESETS_MM = [1.0, 1.5, 2.0, 2.5, 3.0];

export const MIN_MARK_TOP_MM = 20;
export const MIN_MARK_BOTTOM_MM = 20;
export const MIN_MARK_SPAN_MM = 10;

export const DEFAULT_ENVIRONMENT: LabEnvironment = {
  liquidPreset: 'glycerin',
  liquidDensityKgM3: 1260,
  referenceViscosityPas: 0.95,
  useAutoExperimentalViscosity: false,
  ballMaterial: 'steel',
  ballDensityKgM3: 7800,
  cylinderDiameterMm: 50,
  columnHeightMm: 450,
  markAMm: 80,
  markBMm: 330,
  defaultMarkDistanceMm: 250,
  gravityMs2: 9.81,
};

export function getMarkBoundsMm(columnHeightMm: number): {
  minTopMm: number;
  maxBottomMm: number;
  minSpanMm: number;
} {
  const safeH = Math.max(50, Number.isFinite(columnHeightMm) ? columnHeightMm : 450);
  const minTopMm = Math.min(MIN_MARK_TOP_MM, Math.round(safeH * 0.1 * 10) / 10);
  const marginBottom = Math.min(MIN_MARK_BOTTOM_MM, Math.round(safeH * 0.1 * 10) / 10);
  const maxBottomMm = Math.max(minTopMm + 5, safeH - marginBottom);
  const minSpanMm = Math.min(MIN_MARK_SPAN_MM, Math.max(5, maxBottomMm - minTopMm));
  return { minTopMm, maxBottomMm, minSpanMm };
}

export function clampMarkPositions(params: {
  markAMm: number;
  markBMm: number;
  columnHeightMm: number;
  changed?: 'A' | 'B' | 'H';
}): { markAMm: number; markBMm: number; spanMm: number } {
  const { minTopMm, maxBottomMm, minSpanMm } = getMarkBoundsMm(params.columnHeightMm);
  const round1 = (v: number) => Math.round(v * 10) / 10;

  const rawA = Number.isFinite(params.markAMm) ? params.markAMm : minTopMm;
  const rawB = Number.isFinite(params.markBMm) ? params.markBMm : maxBottomMm;

  let nextA = Math.min(maxBottomMm - minSpanMm, Math.max(minTopMm, rawA));
  let nextB = Math.min(maxBottomMm, Math.max(minTopMm + minSpanMm, rawB));

  if (params.changed === 'A') {
    if (nextA > nextB - minSpanMm) {
      nextB = Math.min(maxBottomMm, nextA + minSpanMm);
      nextA = Math.min(nextA, nextB - minSpanMm);
    }
  } else if (params.changed === 'B') {
    if (nextB < nextA + minSpanMm) {
      nextA = Math.max(minTopMm, nextB - minSpanMm);
      nextB = Math.max(nextB, nextA + minSpanMm);
    }
  } else {
    if (nextB - nextA < minSpanMm) {
      nextA = Math.max(minTopMm, nextB - minSpanMm);
      if (nextB - nextA < minSpanMm) {
        nextB = Math.min(maxBottomMm, nextA + minSpanMm);
      }
    }
  }

  nextA = round1(nextA);
  nextB = round1(nextB);
  const spanMm = round1(Math.max(minSpanMm, nextB - nextA));
  return { markAMm: nextA, markBMm: nextB, spanMm };
}

export function computeMarksForSpan(params: {
  markAMm: number;
  targetSpanMm: number;
  columnHeightMm: number;
}): { markAMm: number; markBMm: number; spanMm: number } {
  const { minTopMm, maxBottomMm, minSpanMm } = getMarkBoundsMm(params.columnHeightMm);
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const maxSpan = Math.max(minSpanMm, maxBottomMm - minTopMm);
  const clampedSpan = Math.min(maxSpan, Math.max(minSpanMm, Number.isFinite(params.targetSpanMm) ? params.targetSpanMm : 250));

  let nextA = Math.min(maxBottomMm - minSpanMm, Math.max(minTopMm, Number.isFinite(params.markAMm) ? params.markAMm : minTopMm));
  let nextB = nextA + clampedSpan;
  if (nextB > maxBottomMm) {
    nextB = maxBottomMm;
    nextA = Math.max(minTopMm, nextB - clampedSpan);
  }
  nextA = round1(nextA);
  nextB = round1(nextB);
  return {
    markAMm: nextA,
    markBMm: nextB,
    spanMm: round1(Math.max(minSpanMm, nextB - nextA)),
  };
}

export function computePredictedTimeS(
  radiusMm: number,
  lengthMm: number,
  env: LabEnvironment,
  viscosityPas: number,
): number | null {
  if (
    !Number.isFinite(radiusMm) ||
    !Number.isFinite(lengthMm) ||
    !Number.isFinite(viscosityPas) ||
    !Number.isFinite(env.cylinderDiameterMm) ||
    !Number.isFinite(env.columnHeightMm) ||
    !Number.isFinite(env.gravityMs2) ||
    !Number.isFinite(env.ballDensityKgM3) ||
    !Number.isFinite(env.liquidDensityKgM3)
  ) {
    return null;
  }

  if (
    !(radiusMm > 0) ||
    !(lengthMm > 0) ||
    !(viscosityPas > 0) ||
    !(env.cylinderDiameterMm > 0) ||
    !(env.columnHeightMm > 0) ||
    !(env.gravityMs2 > 0) ||
    !(env.ballDensityKgM3 > 0) ||
    !(env.liquidDensityKgM3 > 0)
  ) {
    return null;
  }

  if (radiusMm * 2 >= env.cylinderDiameterMm) {
    return null;
  }

  const deltaRho = env.ballDensityKgM3 - env.liquidDensityKgM3;
  if (!(deltaRho > 0)) return null;

  const r = radiusMm * 1e-3;
  const R = (env.cylinderDiameterMm / 2) * 1e-3;
  const H = env.columnHeightMm * 1e-3;
  const L = lengthMm * 1e-3;

  const vStokes = (2 * deltaRho * env.gravityMs2 * r * r) / (9 * viscosityPas);
  const f1 = 1 + 2.4 * (r / R);
  const f2 = 1 + 3.3 * (r / H);
  const vObserved = vStokes / (f1 * f2);
  if (!(vObserved > 0) || !Number.isFinite(vObserved)) return null;
  return L / vObserved;
}

export function computeTheoreticalVelocityMs(
  radiusMm: number,
  env: LabEnvironment,
  viscosityPas: number,
): number | null {
  if (
    !Number.isFinite(radiusMm) ||
    !Number.isFinite(viscosityPas) ||
    !Number.isFinite(env.gravityMs2) ||
    !Number.isFinite(env.ballDensityKgM3) ||
    !Number.isFinite(env.liquidDensityKgM3)
  ) {
    return null;
  }
  if (
    !(radiusMm > 0) ||
    !(viscosityPas > 0) ||
    !(env.gravityMs2 > 0) ||
    !(env.ballDensityKgM3 > 0) ||
    !(env.liquidDensityKgM3 > 0)
  ) {
    return null;
  }
  const deltaRho = env.ballDensityKgM3 - env.liquidDensityKgM3;
  if (!(deltaRho > 0)) return null;
  const r = radiusMm * 1e-3;
  return (2 * deltaRho * env.gravityMs2 * r * r) / (9 * viscosityPas);
}

export function formatPredictedTimeS(predictedTimeS: number): number {
  if (!Number.isFinite(predictedTimeS) || !(predictedTimeS > 0)) return 10.0;
  if (predictedTimeS < 0.1) return Number(predictedTimeS.toFixed(6));
  if (predictedTimeS < 10) return Number(predictedTimeS.toFixed(4));
  return Number(predictedTimeS.toFixed(3));
}

export function createActiveBallMeasurement(
  env: LabEnvironment = DEFAULT_ENVIRONMENT,
  radiusMm: number = 1.4,
  lengthMm: number = env.defaultMarkDistanceMm,
  viscosityPas: number = env.referenceViscosityPas,
): BallMeasurement {
  const predictedT = computePredictedTimeS(radiusMm, lengthMm, env, viscosityPas);
  return {
    id: 1,
    label: 'Active Sphere',
    radiusMm,
    lengthMm,
    timeS: predictedT !== null ? formatPredictedTimeS(predictedT) : 10.0,
  };
}

export function createSavedReadingFromTrial(
  ball: BallMeasurement,
  env: LabEnvironment,
  trialNumber: number,
  id: number = Date.now(),
): SavedReading {
  const liquidName =
    LIQUID_PRESETS.find((l) => l.id === env.liquidPreset)?.name ?? 'Custom Liquid';
  const ballMaterialName =
    BALL_MATERIAL_PRESETS.find((m) => m.id === env.ballMaterial)?.name ?? 'Custom Material';

  return {
    id,
    trialNumber,
    label: `Reading #${trialNumber}`,
    radiusMm: ball.radiusMm,
    lengthMm: ball.lengthMm,
    timeS: ball.timeS,
    markAMm: env.markAMm,
    markBMm: env.markBMm,
    ballDensityKgM3: env.ballDensityKgM3,
    liquidDensityKgM3: env.liquidDensityKgM3,
    cylinderDiameterMm: env.cylinderDiameterMm,
    columnHeightMm: env.columnHeightMm,
    gravityMs2: env.gravityMs2,
    liquidPreset: env.liquidPreset,
    liquidName,
    ballMaterialName,
    referenceViscosityPas: env.referenceViscosityPas,
  };
}

export function createSampleSavedReadings(
  env: LabEnvironment = DEFAULT_ENVIRONMENT,
  radiiMm: number[] = [1.0, 1.4, 1.8, 2.2],
  viscosityPas: number = env.referenceViscosityPas,
): SavedReading[] {
  return radiiMm.map((radiusMm, idx) => {
    const lengthMm = env.defaultMarkDistanceMm;
    const predictedT = computePredictedTimeS(radiusMm, lengthMm, env, viscosityPas);
    const trialNumber = idx + 1;
    return createSavedReadingFromTrial(
      {
        id: trialNumber,
        label: `Reading #${trialNumber}`,
        radiusMm,
        lengthMm,
        timeS: predictedT !== null ? formatPredictedTimeS(predictedT) : 10.0,
      },
      env,
      trialNumber,
      trialNumber,
    );
  });
}

export const DEFAULT_ACTIVE_BALL: BallMeasurement = createActiveBallMeasurement(
  DEFAULT_ENVIRONMENT,
  1.4,
  DEFAULT_ENVIRONMENT.defaultMarkDistanceMm,
  DEFAULT_ENVIRONMENT.referenceViscosityPas,
);

// Default seeded sequential readings consistent with Glycerin (20 °C) + Steel so charts/report work immediately
export const DEFAULT_SAVED_READINGS: SavedReading[] = createSampleSavedReadings(
  DEFAULT_ENVIRONMENT,
  [1.0, 1.4, 1.8, 2.2],
  DEFAULT_ENVIRONMENT.referenceViscosityPas,
);

export function computeBallResult(
  ball: BallMeasurement,
  env: LabEnvironment,
  theoreticalViscosityOverridePas?: number | null,
): BallCalculationResult {
  const validationErrors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(ball.radiusMm) || !(ball.radiusMm > 0)) {
    validationErrors.push('Ball radius r must be > 0 mm.');
  }
  if (!Number.isFinite(ball.lengthMm) || !(ball.lengthMm > 0)) {
    validationErrors.push('Travel distance L must be > 0 mm.');
  }
  if (!Number.isFinite(ball.timeS) || !(ball.timeS > 0)) {
    validationErrors.push('Measured time T must be > 0 s.');
  }
  if (!Number.isFinite(env.cylinderDiameterMm) || !(env.cylinderDiameterMm > 0)) {
    validationErrors.push('Cylinder inner diameter D must be > 0 mm.');
  }
  if (!Number.isFinite(env.columnHeightMm) || !(env.columnHeightMm > 0)) {
    validationErrors.push('Liquid column height H must be > 0 mm.');
  }
  if (!Number.isFinite(env.gravityMs2) || !(env.gravityMs2 > 0)) {
    validationErrors.push('Gravity g must be > 0 m/s².');
  }
  if (!Number.isFinite(env.liquidDensityKgM3) || !(env.liquidDensityKgM3 > 0)) {
    validationErrors.push('Liquid density ρl must be > 0 kg/m³.');
  }
  if (!Number.isFinite(env.ballDensityKgM3) || !(env.ballDensityKgM3 > 0)) {
    validationErrors.push('Ball density ρb must be > 0 kg/m³.');
  }

  if (
    Number.isFinite(ball.radiusMm) &&
    Number.isFinite(env.cylinderDiameterMm) &&
    ball.radiusMm > 0 &&
    env.cylinderDiameterMm > 0 &&
    ball.radiusMm * 2 >= env.cylinderDiameterMm
  ) {
    validationErrors.push(
      `Ball diameter (${(ball.radiusMm * 2).toFixed(2)} mm) meets or exceeds cylinder inner diameter D (${env.cylinderDiameterMm} mm). Increase cylinder diameter D or choose a smaller sphere.`,
    );
  }

  if (
    Number.isFinite(ball.lengthMm) &&
    Number.isFinite(env.columnHeightMm) &&
    ball.lengthMm > env.columnHeightMm &&
    env.columnHeightMm > 0
  ) {
    warnings.push(
      `Measurement distance L (${ball.lengthMm} mm) exceeds liquid column height H (${env.columnHeightMm} mm). Reduce L or increase column height H.`,
    );
  }

  const safeRadiusMm = Number.isFinite(ball.radiusMm) && ball.radiusMm > 0 ? ball.radiusMm : 0;
  const safeLengthMm = Number.isFinite(ball.lengthMm) && ball.lengthMm > 0 ? ball.lengthMm : 0;
  const safeTimeS = Number.isFinite(ball.timeS) && ball.timeS > 0 ? ball.timeS : 1e-9;
  const safeCylDiaMm =
    Number.isFinite(env.cylinderDiameterMm) && env.cylinderDiameterMm > 0
      ? env.cylinderDiameterMm
      : 1e-6;
  const safeHeightMm =
    Number.isFinite(env.columnHeightMm) && env.columnHeightMm > 0 ? env.columnHeightMm : 1e-6;
  const safeG = Number.isFinite(env.gravityMs2) && env.gravityMs2 > 0 ? env.gravityMs2 : 0;
  const safeRhoB =
    Number.isFinite(env.ballDensityKgM3) && env.ballDensityKgM3 > 0 ? env.ballDensityKgM3 : 0;
  const safeRhoL =
    Number.isFinite(env.liquidDensityKgM3) && env.liquidDensityKgM3 > 0 ? env.liquidDensityKgM3 : 0;

  const r = safeRadiusMm * 1e-3;
  const R = (safeCylDiaMm / 2) * 1e-3;
  const H = safeHeightMm * 1e-3;
  const L = safeLengthMm * 1e-3;

  const geometryValid = validationErrors.length === 0;
  const observedVelocityMs = geometryValid ? L / safeTimeS : 0;
  const wallCorrectionF1 = 1 + 2.4 * (r / R);
  const bottomCorrectionF2 = 1 + 3.3 * (r / H);
  const combinedCorrectionCL = wallCorrectionF1 * bottomCorrectionF2;
  const correctedVelocityMs = observedVelocityMs * combinedCorrectionCL;

  const deltaRho = safeRhoB - safeRhoL;
  const netSettlingPossible = deltaRho > 0 && geometryValid;

  let buoyancyCondition: BallCalculationResult['buoyancyCondition'] = 'sinking';
  if (!geometryValid) {
    buoyancyCondition = 'invalid';
  } else if (Math.abs(deltaRho) <= 1e-9) {
    buoyancyCondition = 'neutral';
    warnings.push(
      `Ball density (${safeRhoB} kg/m³) equals liquid density (${safeRhoL} kg/m³): net gravity is zero (neutral buoyancy; sphere remains suspended).`,
    );
  } else if (deltaRho < 0) {
    buoyancyCondition = 'floating';
    warnings.push(
      `Ball density (${safeRhoB} kg/m³) < liquid density (${safeRhoL} kg/m³): upward buoyancy exceeds weight, so the sphere floats rather than settling.`,
    );
  }

  const volumeM3 = (4 / 3) * Math.PI * r * r * r;
  const weightForceN = safeRhoB * volumeM3 * safeG;
  const buoyancyForceN = safeRhoL * volumeM3 * safeG;
  const netSettlingForceN = weightForceN - buoyancyForceN;
  const terminalDragForceN = netSettlingPossible ? Math.max(0, netSettlingForceN) : 0;

  let viscosityPas: number | null = null;
  let reynoldsNumber: number | null = null;
  let reynoldsStatus: BallCalculationResult['reynoldsStatus'] = 'unavailable';

  if (netSettlingPossible && correctedVelocityMs > 0) {
    viscosityPas = (2 * deltaRho * safeG * r * r) / (9 * correctedVelocityMs);
    if (viscosityPas > 0 && Number.isFinite(viscosityPas)) {
      reynoldsNumber = (safeRhoL * (2 * r) * correctedVelocityMs) / viscosityPas;
      if (reynoldsNumber < 0.5) {
        reynoldsStatus = 'valid';
      } else if (reynoldsNumber < 1.0) {
        reynoldsStatus = 'caution';
        warnings.push(
          `Reynolds number Re = ${reynoldsNumber.toFixed(3)} (0.5 ≤ Re < 1.0): transitional creeping flow near Stokes validity limit.`,
        );
      } else {
        reynoldsStatus = 'invalid';
        warnings.push(
          `Reynolds number Re = ${reynoldsNumber.toFixed(2)} ≥ 1.0: inertial drag is significant; excluded from Stokes' Law regression and mean η̄. Use a smaller radius or higher-viscosity fluid.`,
        );
      }
    }
  }

  const etaForTheory =
    theoreticalViscosityOverridePas && theoreticalViscosityOverridePas > 0
      ? theoreticalViscosityOverridePas
      : env.referenceViscosityPas;

  const theoreticalVelocityMs =
    netSettlingPossible && Number.isFinite(etaForTheory) && etaForTheory > 0
      ? (2 * deltaRho * safeG * r * r) / (9 * etaForTheory)
      : null;

  const theoreticalObservedVelocityMs =
    theoreticalVelocityMs !== null && combinedCorrectionCL > 0
      ? theoreticalVelocityMs / combinedCorrectionCL
      : null;

  const isStokesAccepted =
    geometryValid &&
    netSettlingPossible &&
    viscosityPas !== null &&
    viscosityPas > 0 &&
    (reynoldsStatus === 'valid' || reynoldsStatus === 'caution');

  let exclusionReason: string | null = null;
  if (!geometryValid) {
    exclusionReason = validationErrors[0];
  } else if (!netSettlingPossible) {
    exclusionReason =
      buoyancyCondition === 'neutral'
        ? 'Neutral buoyancy (ρb = ρl): zero net settling force.'
        : 'Floats (ρb < ρl): no downward settling.';
  } else if (reynoldsStatus === 'invalid') {
    exclusionReason = `Excluded: Re = ${reynoldsNumber?.toFixed(2)} ≥ 1.0 (outside creeping Stokes regime).`;
  } else if (viscosityPas === null || !(viscosityPas > 0)) {
    exclusionReason = 'Invalid or undefined viscosity calculation.';
  }

  return {
    id: ball.id,
    label: ball.label,
    radiusMm: ball.radiusMm,
    radiusM: r,
    radiusSqMm2: ball.radiusMm * ball.radiusMm,
    radiusSqM2: r * r,
    lengthMm: ball.lengthMm,
    lengthM: L,
    timeS: ball.timeS,
    cylinderRadiusM: R,
    columnHeightM: H,
    observedVelocityMs,
    wallCorrectionF1,
    bottomCorrectionF2,
    combinedCorrectionCL,
    correctedVelocityMs,
    theoreticalVelocityMs,
    theoreticalObservedVelocityMs,
    viscosityPas,
    reynoldsNumber,
    reynoldsStatus,
    isStokesAccepted,
    exclusionReason,
    buoyancyCondition,
    volumeM3,
    weightForceN,
    buoyancyForceN,
    netSettlingForceN,
    terminalDragForceN,
    netSettlingPossible,
    validationErrors,
    warnings,
  };
}

export function computeOriginRegression(points: Array<{ x: number; y: number }>): {
  slope: number | null;
  rSquared: number | null;
  hasDistinctX?: boolean;
} {
  const validPoints = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0 && p.y >= 0,
  );
  if (validPoints.length === 0) return { slope: null, rSquared: null, hasDistinctX: false };

  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let xMin = Infinity;
  let xMax = -Infinity;
  let sumX = 0;

  for (const p of validPoints) {
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
    sumX += p.x;
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
  }

  if (!(sumXX > 0)) return { slope: null, rSquared: null, hasDistinctX: false };
  const slope = sumXY / sumXX;

  // Linearity R² cannot be verified from < 2 points or when all readings share the exact same radius
  const meanX = sumX / validPoints.length;
  const hasDistinctX =
    validPoints.length >= 2 && xMax - xMin > 1e-9 * Math.max(1e-12, Math.abs(meanX));

  if (validPoints.length < 2 || !hasDistinctX) {
    return { slope, rSquared: null, hasDistinctX };
  }

  const meanY = validPoints.reduce((acc, p) => acc + p.y, 0) / validPoints.length;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of validPoints) {
    const yHat = slope * p.x;
    ssRes += (p.y - yHat) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }

  const scaleFloor = 1e-12 * Math.max(1e-18, sumYY);
  let rSquared: number | null;
  if (ssTot <= scaleFloor) {
    // Constant y across distinct x (e.g. v = const != m*r^2): ssRes > 0 means fit fails (R² = 0),
    // whereas identically zero residuals + identically zero totals is degenerate (null).
    rSquared = ssRes <= scaleFloor ? null : 0;
  } else {
    rSquared = Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  }
  return { slope, rSquared, hasDistinctX };
}

function resolveReadingEnv(reading: BallMeasurement | SavedReading, baseEnv: LabEnvironment): LabEnvironment {
  if ('ballDensityKgM3' in reading && 'liquidDensityKgM3' in reading) {
    const presetMeta = LIQUID_PRESETS.find((l) => l.id === reading.liquidPreset);
    const readingRefEta =
      typeof reading.referenceViscosityPas === 'number' &&
      Number.isFinite(reading.referenceViscosityPas) &&
      reading.referenceViscosityPas > 0
        ? reading.referenceViscosityPas
        : presetMeta && Math.abs(presetMeta.densityKgM3 - reading.liquidDensityKgM3) < 1e-6
          ? presetMeta.referenceViscosityPas
          : baseEnv.referenceViscosityPas;

    return {
      ...baseEnv,
      liquidPreset: reading.liquidPreset,
      liquidDensityKgM3: reading.liquidDensityKgM3,
      referenceViscosityPas: readingRefEta,
      ballDensityKgM3: reading.ballDensityKgM3,
      cylinderDiameterMm: reading.cylinderDiameterMm,
      columnHeightMm: reading.columnHeightMm,
      gravityMs2: reading.gravityMs2,
    };
  }
  return baseEnv;
}

export function computeExperimentSummary(
  readings: Array<BallMeasurement | SavedReading>,
  env: LabEnvironment,
): ExperimentSummary {
  // First pass: evaluate each sequential reading against its own saved snapshot conditions
  const resolvedEnvs = readings.map((b) => resolveReadingEnv(b, env));
  const prelimResults = readings.map((b, idx) => computeBallResult(b, resolvedEnvs[idx], null));
  const acceptedPrelim = prelimResults.filter((r) => r.isStokesAccepted);

  // Check whether accepted readings span different fluids vs different densities/gravities
  const acceptedEnvs = resolvedEnvs.filter((_, idx) => prelimResults[idx]?.isStokesAccepted);

  const hasMixedFluidConditions =
    acceptedEnvs.length > 1 &&
    acceptedEnvs.some(
      (e) =>
        Math.abs(e.liquidDensityKgM3 - acceptedEnvs[0].liquidDensityKgM3) > 1e-6 ||
        (e.liquidPreset !== 'custom' &&
          acceptedEnvs[0].liquidPreset !== 'custom' &&
          e.liquidPreset !== acceptedEnvs[0].liquidPreset),
    );

  const hasMixedMediumConditions =
    hasMixedFluidConditions ||
    (acceptedEnvs.length > 1 &&
      acceptedEnvs.some(
        (e) =>
          Math.abs(e.ballDensityKgM3 - acceptedEnvs[0].ballDensityKgM3) > 1e-6 ||
          Math.abs(e.gravityMs2 - acceptedEnvs[0].gravityMs2) > 1e-6,
      ));

  const acceptedViscosities = acceptedPrelim
    .map((r) => r.viscosityPas)
    .filter((v): v is number => v !== null && v > 0 && Number.isFinite(v));

  // Averaging viscosity across distinct liquids (e.g. Glycerin + Honey) is physically meaningless
  const averageViscosityPas =
    !hasMixedFluidConditions && acceptedViscosities.length > 0
      ? acceptedViscosities.reduce((sum, v) => sum + v, 0) / acceptedViscosities.length
      : null;

  const validReferenceEta =
    Number.isFinite(env.referenceViscosityPas) && env.referenceViscosityPas > 0
      ? env.referenceViscosityPas
      : null;

  const activeTheoreticalViscosityPas =
    env.useAutoExperimentalViscosity && averageViscosityPas !== null
      ? averageViscosityPas
      : validReferenceEta;

  // Second pass: only apply active theoretical viscosity override when readings share fluid conditions
  // (when mixed fluids exist, each reading keeps its own saved fluid reference viscosity)
  const results = readings.map((b, idx) => {
    const rEnv = resolvedEnvs[idx];
    const overrideEta =
      env.useAutoExperimentalViscosity && averageViscosityPas !== null && !hasMixedFluidConditions
        ? averageViscosityPas
        : rEnv.referenceViscosityPas > 0
          ? rEnv.referenceViscosityPas
          : validReferenceEta;
    return computeBallResult(b, rEnv, overrideEta);
  });

  const acceptedResults = results.filter((r) => r.isStokesAccepted);
  const cautionResults = acceptedResults.filter((r) => r.reynoldsStatus === 'caution');
  const excludedResults = results.filter((r) => !r.isStokesAccepted);

  // Under mixed medium conditions (differing rho_l, rho_b, g, or fluid), a single v = m * r^2 slope is invalid
  let graphSlopePerMS: number | null = null;
  let graphRSquared: number | null = null;
  let observedGraphSlopePerMS: number | null = null;
  let observedGraphRSquared: number | null = null;
  let hasDistinctX = false;

  if (!hasMixedMediumConditions) {
    const acceptedPoints = acceptedResults.map((r) => ({
      x: r.radiusSqM2,
      y: r.correctedVelocityMs,
    }));
    const observedPoints = acceptedResults.map((r) => ({
      x: r.radiusSqM2,
      y: r.observedVelocityMs,
    }));

    const reg = computeOriginRegression(acceptedPoints);
    const obsReg = computeOriginRegression(observedPoints);
    graphSlopePerMS = reg.slope;
    graphRSquared = reg.rSquared;
    hasDistinctX = Boolean(reg.hasDistinctX);
    observedGraphSlopePerMS = obsReg.slope;
    observedGraphRSquared = obsReg.rSquared;
  }

  const regressionEnv =
    acceptedEnvs.length > 0 && !hasMixedMediumConditions ? acceptedEnvs[0] : env;

  const envDeltaRho = env.ballDensityKgM3 - env.liquidDensityKgM3;
  const hasCriticalDensityError =
    !Number.isFinite(envDeltaRho) ||
    envDeltaRho <= 0 ||
    !(env.ballDensityKgM3 > 0) ||
    !(env.liquidDensityKgM3 > 0);

  const regDeltaRho = regressionEnv.ballDensityKgM3 - regressionEnv.liquidDensityKgM3;
  let graphDerivedViscosityPas: number | null = null;
  if (
    !hasMixedMediumConditions &&
    Number.isFinite(regDeltaRho) &&
    regDeltaRho > 0 &&
    graphSlopePerMS !== null &&
    graphSlopePerMS > 0 &&
    Number.isFinite(regressionEnv.gravityMs2) &&
    regressionEnv.gravityMs2 > 0
  ) {
    graphDerivedViscosityPas =
      (2 * regDeltaRho * regressionEnv.gravityMs2) / (9 * graphSlopePerMS);
  }

  let viscosityDiscrepancyPct: number | null = null;
  if (averageViscosityPas && graphDerivedViscosityPas) {
    viscosityDiscrepancyPct =
      (Math.abs(graphDerivedViscosityPas - averageViscosityPas) / averageViscosityPas) * 100;
  }

  let discrepancyVsReferencePct: number | null = null;
  if (averageViscosityPas && validReferenceEta) {
    discrepancyVsReferencePct =
      (Math.abs(averageViscosityPas - validReferenceEta) / validReferenceEta) * 100;
  }

  let rSquaredStatus: RSquaredStatus = 'valid';
  if (hasMixedMediumConditions) {
    rSquaredStatus = 'mixed_conditions';
  } else if (acceptedResults.length < 2) {
    rSquaredStatus = 'insufficient_points';
  } else if (!hasDistinctX) {
    rSquaredStatus = 'same_radius';
  }

  const regressionInsufficientData = rSquaredStatus !== 'valid';

  const globalWarnings: string[] = [];
  if (
    !Number.isFinite(env.referenceViscosityPas) ||
    !(env.referenceViscosityPas > 0)
  ) {
    globalWarnings.push(
      'Reference viscosity η must be > 0 Pa·s for valid theoretical velocity predictions.',
    );
  }

  if (hasCriticalDensityError) {
    if (Math.abs(envDeltaRho) <= 1e-9) {
      globalWarnings.push(
        `Ball density (${env.ballDensityKgM3} kg/m³) equals liquid density (${env.liquidDensityKgM3} kg/m³): neutral buoyancy (net force = 0 N). Increase ball density or decrease liquid density for settling.`,
      );
    } else {
      globalWarnings.push(
        `Ball density (${env.ballDensityKgM3} kg/m³) is below liquid density (${env.liquidDensityKgM3} kg/m³): the sphere floats upward rather than settling.`,
      );
    }
  }

  const allErrors = Array.from(new Set(results.flatMap((r) => r.validationErrors)));
  for (const err of allErrors) {
    globalWarnings.push(err);
  }

  const distanceWarnings = results.filter((r, idx) => {
    const rEnv = resolvedEnvs[idx];
    return (
      Number.isFinite(r.lengthMm) &&
      Number.isFinite(rEnv.columnHeightMm) &&
      r.lengthMm > rEnv.columnHeightMm &&
      rEnv.columnHeightMm > 0
    );
  });
  if (distanceWarnings.length > 0) {
    globalWarnings.push(
      `${distanceWarnings.map((b) => b.label).join(', ')} travel distance L exceeds liquid column height H. Reduce L or increase H.`,
    );
  }

  const highReBalls = results.filter((r) => r.reynoldsStatus === 'invalid');
  if (highReBalls.length > 0) {
    globalWarnings.push(
      `${highReBalls.map((b) => b.label).join(', ')} exceeded Re ≥ 1.0 and ${highReBalls.length === 1 ? 'was' : 'were'} excluded from mean η̄ and Stokes regression. Use a smaller radius or higher-viscosity fluid.`,
    );
  }

  if (cautionResults.length > 0) {
    globalWarnings.push(
      `${cautionResults.map((b) => b.label).join(', ')} in transitional creeping regime (0.5 ≤ Re < 1.0); accepted with caution marker.`,
    );
  }

  if (hasMixedMediumConditions) {
    globalWarnings.push(
      hasMixedFluidConditions
        ? 'Saved readings span multiple fluid media; pooled mean η̄ and single-line v vs r² regression are disabled because slope m = 2(ρb − ρl)g / (9η) only holds within a single medium.'
        : 'Saved readings span multiple sphere densities or gravities; single-line v vs r² regression (η_graph, R²) is disabled because slope depends on (ρb − ρl)g.',
    );
  } else if (rSquaredStatus === 'same_radius' && !hasCriticalDensityError && allErrors.length === 0) {
    globalWarnings.push(
      'All saved readings share the same sphere radius r: save trials at ≥ 2 distinct radii to compute R² linearity and verify v ∝ r².',
    );
  } else if (rSquaredStatus === 'insufficient_points' && !hasCriticalDensityError && allErrors.length === 0) {
    globalWarnings.push(
      results.length === 0
        ? 'No saved readings in the sequential dataset yet. Run the single-ball experiment and click "Save Reading" to collect points for regression.'
        : acceptedResults.length === 0
          ? 'Insufficient valid Stokes-regime readings (0 accepted): cannot compute mean η̄ or regression.'
          : 'Only 1 accepted saved reading: run and save at least 2 readings at different radii to compute R² linearity and verify v ∝ r².',
    );
  }

  if (
    discrepancyVsReferencePct !== null &&
    discrepancyVsReferencePct > 15 &&
    !env.useAutoExperimentalViscosity &&
    validReferenceEta !== null &&
    !hasMixedMediumConditions
  ) {
    globalWarnings.push(
      `Saved dataset mean viscosity (${averageViscosityPas!.toFixed(4)} Pa·s) differs from active reference viscosity (${validReferenceEta.toFixed(4)} Pa·s) by ${discrepancyVsReferencePct.toFixed(1)}%.`,
    );
  }

  return {
    results,
    acceptedResults,
    cautionResults,
    excludedResults,
    validViscosityCount: !hasMixedFluidConditions ? acceptedViscosities.length : 0,
    averageViscosityPas,
    graphSlopePerMS,
    graphSlopeDisplayMm2PerS: graphSlopePerMS !== null ? graphSlopePerMS * 1e-6 : null,
    graphRSquared,
    rSquaredStatus,
    graphDerivedViscosityPas,
    observedGraphSlopePerMS,
    observedGraphRSquared,
    viscosityDiscrepancyPct,
    discrepancyVsReferencePct,
    activeTheoreticalViscosityPas,
    hasCriticalDensityError,
    hasMixedMediumConditions,
    hasMixedFluidConditions,
    regressionInsufficientData,
    globalWarnings,
  };
}

/**
 * Analytical falling-sphere kinematics from release (y=0) through acceleration
 * into steady terminal velocity inside the cylinder.
 *
 * Uses exact Stokes exponential relaxation:
 *   v(t) = v_term * (1 - exp(-t / tau))
 *   y(t) = v_term * (t - tau * (1 - exp(-t / tau)))
 *
 * When `pedagogicalRamp` is enabled and physical relaxation tau_phys is very short
 * (e.g. a few milliseconds in glycerin), an extended visualization timescale
 * `tauEffective = max(tau_phys, 0.35 s)` lets students visually observe drag buildup.
 */
export function evaluateFallKinematics(params: {
  timeS: number;
  radiusM: number;
  ballDensityKgM3: number;
  liquidDensityKgM3: number;
  gravityMs2: number;
  terminalObservedVelocityMs: number;
  effectiveViscosityPas: number;
  totalTravelM: number;
  pedagogicalRamp?: boolean;
}): FallKinematicsState {
  const {
    timeS,
    radiusM,
    ballDensityKgM3,
    liquidDensityKgM3,
    gravityMs2,
    terminalObservedVelocityMs,
    effectiveViscosityPas,
    totalTravelM,
    pedagogicalRamp = true,
  } = params;

  const safeR = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 0;
  const safeRhoB = Number.isFinite(ballDensityKgM3) && ballDensityKgM3 > 0 ? ballDensityKgM3 : 0;
  const safeRhoL = Number.isFinite(liquidDensityKgM3) && liquidDensityKgM3 > 0 ? liquidDensityKgM3 : 0;
  const safeG = Number.isFinite(gravityMs2) && gravityMs2 > 0 ? gravityMs2 : 0;

  const volumeM3 = (4 / 3) * Math.PI * safeR * safeR * safeR;
  const weightForceN = safeRhoB * volumeM3 * safeG;
  const buoyancyForceN = safeRhoL * volumeM3 * safeG;
  const netGravityN = weightForceN - buoyancyForceN;

  const deltaRho = safeRhoB - safeRhoL;
  const buoyancyCondition: FallKinematicsState['buoyancyCondition'] =
    Math.abs(deltaRho) <= 1e-9 ? 'neutral' : deltaRho < 0 ? 'floating' : 'sinking';

  if (buoyancyCondition !== 'sinking' || !(terminalObservedVelocityMs > 0) || !(safeR > 0)) {
    return {
      timeS: Math.max(0, timeS),
      displacementM: 0,
      velocityMs: 0,
      accelerationMs2: 0,
      terminalVelocityMs: 0,
      dragForceN: 0,
      buoyancyForceN,
      weightForceN,
      netGravityForceN: netGravityN,
      buoyancyCondition,
      phase: 'floating',
      progressFraction: buoyancyCondition === 'neutral' ? 0.5 : 0,
      tauPhysS: 0,
      tauEffectiveS: 0,
      isPedagogicalRampUsed: false,
    };
  }

  const etaSafe =
    Number.isFinite(effectiveViscosityPas) && effectiveViscosityPas > 0
      ? effectiveViscosityPas
      : 1e-6;
  const tauPhysS = (2 * safeRhoB * safeR * safeR) / (9 * etaSafe);
  const tauEffectiveS = pedagogicalRamp ? Math.max(tauPhysS, 0.35) : Math.max(tauPhysS, 1e-4);
  const isPedagogicalRampUsed = pedagogicalRamp && tauPhysS < 0.35;

  if (timeS <= 0) {
    return {
      timeS: 0,
      displacementM: 0,
      velocityMs: 0,
      accelerationMs2: netGravityN / Math.max(1e-12, safeRhoB * volumeM3),
      terminalVelocityMs: terminalObservedVelocityMs,
      dragForceN: 0,
      buoyancyForceN,
      weightForceN,
      netGravityForceN: netGravityN,
      buoyancyCondition: 'sinking',
      phase: 'ready',
      progressFraction: 0,
      tauPhysS,
      tauEffectiveS,
      isPedagogicalRampUsed,
    };
  }

  const expTerm = Math.exp(-timeS / tauEffectiveS);
  const velocityMs = terminalObservedVelocityMs * (1 - expTerm);
  const displacementM = terminalObservedVelocityMs * (timeS - tauEffectiveS * (1 - expTerm));
  const accelerationMs2 = (terminalObservedVelocityMs / tauEffectiveS) * expTerm;

  // Drag grows proportionally to v(t) up to netGravityN at terminal velocity
  const dragRatio = terminalObservedVelocityMs > 0 ? velocityMs / terminalObservedVelocityMs : 0;
  const dragForceN = netGravityN * dragRatio;

  const safeTravelM = Math.max(1e-4, totalTravelM);
  const clampedDisp = Math.min(displacementM, safeTravelM);
  const progressFraction = Math.min(1, clampedDisp / safeTravelM);

  let phase: FallKinematicsState['phase'] = 'accelerating';
  if (displacementM >= safeTravelM) {
    phase = 'completed';
  } else if (dragRatio >= 0.96) {
    phase = 'terminal';
  }

  return {
    timeS,
    displacementM: clampedDisp,
    velocityMs: phase === 'completed' ? 0 : velocityMs,
    accelerationMs2: phase === 'completed' ? 0 : accelerationMs2,
    terminalVelocityMs: terminalObservedVelocityMs,
    dragForceN: phase === 'completed' ? netGravityN : dragForceN,
    buoyancyForceN,
    weightForceN,
    netGravityForceN: netGravityN,
    buoyancyCondition: 'sinking',
    phase,
    progressFraction,
    tauPhysS,
    tauEffectiveS,
    isPedagogicalRampUsed,
  };
}
