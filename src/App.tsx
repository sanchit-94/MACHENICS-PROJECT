import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  BookmarkPlus,
  CheckCircle2,
  FlaskConical,
  Play,
  Presentation,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';
import {
  BALL_MATERIAL_PRESETS,
  DEFAULT_ACTIVE_BALL,
  DEFAULT_ENVIRONMENT,
  DEFAULT_SAVED_READINGS,
  LIQUID_PRESETS,
  RADIUS_PRESETS_MM,
  clampMarkPositions,
  computeBallResult,
  computeExperimentSummary,
  computeMarksForSpan,
  computePredictedTimeS,
  createSampleSavedReadings,
  createSavedReadingFromTrial,
  formatPredictedTimeS,
  getMarkBoundsMm,
  type BallMaterialId,
  type BallMeasurement,
  type LabEnvironment,
  type LiquidPresetId,
  type SavedReading,
} from './physics/stokes';
import {
  StokesLab3D,
  type GateTimingState,
  type SimulationConfig,
} from './components/StokesLab3D';
import { ScientificGraphs } from './components/ScientificGraphs';
import { ComparisonLab } from './components/ComparisonLab';
import { LabReport } from './components/LabReport';
import { PresentationMode } from './components/PresentationMode';
import { LabWindow } from './components/LabWindow';
import { MathFormula } from './components/MathFormula';
import { InstitutionalFooter } from './components/InstitutionalFooter';

export default function App() {
  const [isAutostart] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  });

  const [headerLogoError, setHeaderLogoError] = useState<boolean>(false);
  const [env, setEnv] = useState<LabEnvironment>(DEFAULT_ENVIRONMENT);
  const [activeBall, setActiveBall] = useState<BallMeasurement>(DEFAULT_ACTIVE_BALL);
  const [isTimeManual, setIsTimeManual] = useState<boolean>(false);
  const [savedReadings, setSavedReadings] = useState<SavedReading[]>(DEFAULT_SAVED_READINGS);
  const [isUsingSampleDataset, setIsUsingSampleDataset] = useState<boolean>(true);
  const [nextTrialNumber, setNextTrialNumber] = useState<number>(DEFAULT_SAVED_READINGS.length + 1);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const [lengthUnit, setLengthUnit] = useState<'mm' | 'cm'>('mm');
  const [velocitySource, setVelocitySource] = useState<'live_physics' | 'measured_run'>('live_physics');
  const [pedagogicalRamp, setPedagogicalRamp] = useState<boolean>(true);
  const [simStatus, setSimStatus] = useState<'ready' | 'running' | 'paused' | 'completed'>('ready');
  const [gateTiming, setGateTiming] = useState<GateTimingState>({
    active: false,
    elapsedS: 0,
    completedTransitS: null,
  });

  const [simRunSignal, setSimRunSignal] = useState<number>(0);
  const [simStopSignal, setSimStopSignal] = useState<number>(0);
  const [simResetSignal, setSimResetSignal] = useState<number>(0);
  const [presentationOpen, setPresentationOpen] = useState<boolean>(false);

  const labSectionRef = useRef<HTMLDivElement>(null);

  // Summary across sequentially saved readings (for regression, mean eta, graphs, report)
  const summary = useMemo(
    () => computeExperimentSummary(savedReadings, env),
    [savedReadings, env],
  );

  // Active single-ball physics calculation (uses active environment + active sphere parameters)
  const activeBallEtaRef = useMemo(() => {
    if (env.useAutoExperimentalViscosity && summary.averageViscosityPas !== null) {
      return summary.averageViscosityPas;
    }
    return env.referenceViscosityPas > 0 ? env.referenceViscosityPas : null;
  }, [env.useAutoExperimentalViscosity, env.referenceViscosityPas, summary.averageViscosityPas]);

  const activeBallResult = useMemo(
    () => computeBallResult(activeBall, env, activeBallEtaRef),
    [activeBall, env, activeBallEtaRef],
  );

  // Keep the initial 4-trial sample dataset synced whenever fluid, density, or cylinder geometry changes
  // (Stops auto-overwriting once user saves, removes, or clears readings in their own session)
  useEffect(() => {
    if (!isUsingSampleDataset) return;
    const targetEta = env.referenceViscosityPas > 0 ? env.referenceViscosityPas : 0.95;
    const fresh = createSampleSavedReadings(env, [1.0, 1.4, 1.8, 2.2], targetEta);
    setSavedReadings(fresh);
    setNextTrialNumber(fresh.length + 1);
  }, [
    isUsingSampleDataset,
    env.liquidPreset,
    env.liquidDensityKgM3,
    env.referenceViscosityPas,
    env.ballMaterial,
    env.ballDensityKgM3,
    env.cylinderDiameterMm,
    env.columnHeightMm,
    env.markAMm,
    env.markBMm,
    env.defaultMarkDistanceMm,
    env.gravityMs2,
  ]);

  // Keep simulated active ball stopwatch time synced whenever auto-sync is active
  useEffect(() => {
    if (isTimeManual) return;
    const targetEta =
      activeBallEtaRef !== null && activeBallEtaRef > 0
        ? activeBallEtaRef
        : env.referenceViscosityPas > 0
          ? env.referenceViscosityPas
          : 0.95;
    const pred = computePredictedTimeS(activeBall.radiusMm, activeBall.lengthMm, env, targetEta);
    if (pred !== null && pred > 0) {
      const formatted = formatPredictedTimeS(pred);
      if (Math.abs(formatted - activeBall.timeS) > 1e-7) {
        setActiveBall((prev) => ({ ...prev, timeS: formatted }));
      }
    }
  }, [
    isTimeManual,
    activeBall.radiusMm,
    activeBall.lengthMm,
    activeBall.timeS,
    activeBallEtaRef,
    env,
  ]);

  const activeViscosityForSim = useMemo(() => {
    if (velocitySource === 'measured_run') {
      if (activeBallResult.viscosityPas && activeBallResult.viscosityPas > 0) {
        return activeBallResult.viscosityPas;
      }
      return (
        summary.averageViscosityPas ??
        (env.referenceViscosityPas > 0 ? env.referenceViscosityPas : 0.95)
      );
    }
    if (env.useAutoExperimentalViscosity && summary.averageViscosityPas) {
      return summary.averageViscosityPas;
    }
    return env.referenceViscosityPas > 0 ? env.referenceViscosityPas : 0.95;
  }, [
    env.useAutoExperimentalViscosity,
    env.referenceViscosityPas,
    velocitySource,
    activeBallResult.viscosityPas,
    summary.averageViscosityPas,
  ]);

  const simConfig: SimulationConfig = useMemo(
    () => ({
      env,
      selectedBall: activeBallResult,
      velocitySource,
      activeViscosityPas: activeViscosityForSim,
      pedagogicalRamp,
    }),
    [env, activeBallResult, velocitySource, activeViscosityForSim, pedagogicalRamp],
  );

  const handleUpdateEnv = (patch: Partial<LabEnvironment>) => {
    setEnv((prev) => ({ ...prev, ...patch }));
  };

  const handleSelectLiquidPreset = (presetId: LiquidPresetId) => {
    const found = LIQUID_PRESETS.find((l) => l.id === presetId);
    if (!found) {
      handleUpdateEnv({ liquidPreset: 'custom' });
      return;
    }
    setIsTimeManual(false);
    handleUpdateEnv({
      liquidPreset: found.id,
      liquidDensityKgM3: found.densityKgM3,
      referenceViscosityPas: found.referenceViscosityPas,
      useAutoExperimentalViscosity: false,
    });
  };

  const handleSelectBallMaterial = (matId: BallMaterialId) => {
    const found = BALL_MATERIAL_PRESETS.find((m) => m.id === matId);
    if (!found) {
      handleUpdateEnv({ ballMaterial: 'custom' });
      return;
    }
    handleUpdateEnv({
      ballMaterial: found.id,
      ballDensityKgM3: found.densityKgM3,
    });
  };

  const handleUpdateActiveBall = (patch: Partial<BallMeasurement>, manualTimeChange = false) => {
    if (manualTimeChange) {
      setIsTimeManual(true);
    }
    setActiveBall((prev) => ({ ...prev, ...patch }));
  };

  const handleSyncActiveTimeToFluid = () => {
    setIsTimeManual(false);
    const targetEta =
      activeBallEtaRef !== null && activeBallEtaRef > 0
        ? activeBallEtaRef
        : env.referenceViscosityPas > 0
          ? env.referenceViscosityPas
          : 0.95;
    const pred = computePredictedTimeS(activeBall.radiusMm, activeBall.lengthMm, env, targetEta);
    if (pred !== null && pred > 0) {
      setActiveBall((prev) => ({ ...prev, timeS: formatPredictedTimeS(pred) }));
    }
  };

  const handleSyncDatasetToFluid = () => {
    const targetEta = env.referenceViscosityPas > 0 ? env.referenceViscosityPas : 0.95;
    const fresh = createSampleSavedReadings(env, [1.0, 1.4, 1.8, 2.2], targetEta);
    setIsUsingSampleDataset(true);
    setSavedReadings(fresh);
    setNextTrialNumber(fresh.length + 1);
  };

  const handleKeepActiveMediumReadings = () => {
    setIsUsingSampleDataset(false);
    setSavedReadings((prev) =>
      prev.filter(
        (r) =>
          Math.abs(r.liquidDensityKgM3 - env.liquidDensityKgM3) <= 1e-6 &&
          Math.abs(r.ballDensityKgM3 - env.ballDensityKgM3) <= 1e-6 &&
          Math.abs(r.gravityMs2 - env.gravityMs2) <= 1e-6 &&
          (r.liquidPreset === 'custom' ||
            env.liquidPreset === 'custom' ||
            r.liquidPreset === env.liquidPreset),
      ),
    );
  };

  const handleMarksChange = (
    nextMarkAMm: number,
    nextMarkBMm: number,
    changed?: 'A' | 'B',
  ) => {
    const clamped = clampMarkPositions({
      markAMm: nextMarkAMm,
      markBMm: nextMarkBMm,
      columnHeightMm: env.columnHeightMm,
      changed,
    });
    setEnv((prev) => ({
      ...prev,
      markAMm: clamped.markAMm,
      markBMm: clamped.markBMm,
      defaultMarkDistanceMm: clamped.spanMm,
    }));
    setActiveBall((prev) => ({ ...prev, lengthMm: clamped.spanMm }));
  };

  const handleResetMarks = () => {
    const fallback = computeMarksForSpan({
      markAMm: 80,
      targetSpanMm: 250,
      columnHeightMm: env.columnHeightMm,
    });
    handleMarksChange(fallback.markAMm, fallback.markBMm);
  };

  const handleApplyDefaultSpan = () => {
    const synced = computeMarksForSpan({
      markAMm: env.markAMm ?? 80,
      targetSpanMm: env.defaultMarkDistanceMm,
      columnHeightMm: env.columnHeightMm,
    });
    setEnv((prev) => ({
      ...prev,
      markAMm: synced.markAMm,
      markBMm: synced.markBMm,
      defaultMarkDistanceMm: synced.spanMm,
    }));
    setActiveBall((prev) => ({ ...prev, lengthMm: synced.spanMm }));
  };

  // Single-ball experiment controls
  const handleRunExperiment = () => {
    setSimRunSignal((s) => s + 1);
  };

  const handleStopExperiment = () => {
    setSimStopSignal((s) => s + 1);
  };

  const handleResetCurrentExperiment = () => {
    setSimResetSignal((s) => s + 1);
    setGateTiming({ active: false, elapsedS: 0, completedTransitS: null });
  };

  const handleSaveReading = () => {
    const trialNum = nextTrialNumber;
    const newReading = createSavedReadingFromTrial(
      activeBall,
      env,
      trialNum,
      Date.now() + trialNum,
    );
    setIsUsingSampleDataset(false);
    setSavedReadings((prev) => [...prev, newReading]);
    setNextTrialNumber((n) => n + 1);
    setSaveFeedback(`Saved ${newReading.label} (r = ${newReading.radiusMm.toFixed(1)} mm)`);
    window.setTimeout(() => {
      setSaveFeedback((curr) =>
        curr === `Saved ${newReading.label} (r = ${newReading.radiusMm.toFixed(1)} mm)`
          ? null
          : curr,
      );
    }, 3200);
  };

  const handleRemoveReading = (id: number) => {
    setIsUsingSampleDataset(false);
    setSavedReadings((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAllSavedReadings = () => {
    setIsUsingSampleDataset(false);
    setSavedReadings([]);
    setNextTrialNumber(1);
    setSaveFeedback('Cleared all saved readings');
    window.setTimeout(() => {
      setSaveFeedback((curr) => (curr === 'Cleared all saved readings' ? null : curr));
    }, 2600);
  };

  const handleLoadReadingIntoActive = (reading: SavedReading) => {
    setIsTimeManual(true);
    const synced =
      typeof reading.markAMm === 'number' && typeof reading.markBMm === 'number'
        ? clampMarkPositions({
            markAMm: reading.markAMm,
            markBMm: reading.markBMm,
            columnHeightMm: env.columnHeightMm,
          })
        : computeMarksForSpan({
            markAMm: env.markAMm ?? 80,
            targetSpanMm: reading.lengthMm,
            columnHeightMm: env.columnHeightMm,
          });
    setEnv((prev) => ({
      ...prev,
      markAMm: synced.markAMm,
      markBMm: synced.markBMm,
      defaultMarkDistanceMm: synced.spanMm,
    }));
    setActiveBall({
      id: 1,
      label: 'Active Sphere',
      radiusMm: reading.radiusMm,
      lengthMm: reading.lengthMm,
      timeS: reading.timeS,
    });
    setSimResetSignal((s) => s + 1);
  };

  const handleUseMeasuredGateTime = () => {
    const measured = gateTiming.completedTransitS ?? gateTiming.elapsedS;
    if (measured > 0.001) {
      setIsTimeManual(true);
      setActiveBall((prev) => ({ ...prev, timeS: formatPredictedTimeS(measured) }));
      setVelocitySource('measured_run');
    }
  };

  const handleStartExperiment = () => {
    labSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const innerRadiusMm = env.cylinderDiameterMm / 2;
  const markBounds = getMarkBoundsMm(env.columnHeightMm);
  const currentMarkAMm = env.markAMm ?? 80;
  const currentMarkBMm = env.markBMm ?? 330;

  // Combined window 01 alert evaluation (active ball + saved dataset warnings)
  const activeAlerts = useMemo(() => {
    const list: string[] = [];
    if (activeBallResult.buoyancyCondition === 'neutral') {
      list.push(
        `Active Sphere: Neutral buoyancy (ρb = ${env.ballDensityKgM3} kg/m³ equals ρl = ${env.liquidDensityKgM3} kg/m³); sphere stays suspended.`,
      );
    } else if (activeBallResult.buoyancyCondition === 'floating') {
      list.push(
        `Active Sphere: Buoyant float condition (ρb = ${env.ballDensityKgM3} kg/m³ < ρl = ${env.liquidDensityKgM3} kg/m³); sphere rises to meniscus instead of settling.`,
      );
    }
    for (const err of activeBallResult.validationErrors) {
      if (!list.includes(err)) list.push(err);
    }
    if (activeBallResult.reynoldsStatus === 'invalid') {
      list.push(
        `Active Sphere: Reynolds number Re = ${activeBallResult.reynoldsNumber?.toFixed(2)} ≥ 1.0 (outside Stokes creeping-flow regime). Reduce radius or choose a higher-viscosity fluid.`,
      );
    }
    for (const w of summary.globalWarnings) {
      if (!list.some((existing) => existing === w)) {
        list.push(w);
      }
    }
    return list;
  }, [activeBallResult, env.ballDensityKgM3, env.liquidDensityKgM3, summary.globalWarnings]);

  const hasCriticalAlert =
    summary.hasCriticalDensityError ||
    activeBallResult.validationErrors.length > 0 ||
    summary.results.some((r) => r.validationErrors.length > 0);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#050914] text-slate-100 lab-grid-bg relative">
      {/* Subtle on-load laboratory initialization sweep bar */}
      <div
        aria-hidden="true"
        className="no-print lab-load-bar pointer-events-none fixed top-0 left-0 right-0 z-50 h-0.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500"
      />
      {/* Official IIITDM Jabalpur Institutional Header */}
      <header
        data-testid="institutional-header"
        className="no-print lab-header-enter border-b border-sky-400/20 bg-[#060c1d]/95"
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          {/* Left: Official College Logo + Full Institute Name */}
          <a
            href="#top"
            className="flex items-center gap-3.5 sm:gap-4 min-w-0 group"
          >
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl border border-slate-300/80 bg-white p-1 shadow-md">
              {!headerLogoError ? (
                <img
                  src="/assets/aistudio/images_eb0586ab.jpg"
                  alt="IIITDM Jabalpur Official College Logo"
                  referrerPolicy="no-referrer"
                  onError={() => setHeaderLogoError(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-display text-xs font-extrabold text-slate-900 text-center">
                  IIITDMJ
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-display text-xs font-extrabold tracking-[0.16em] text-cyan-300 sm:text-sm">
                IIITDM JABALPUR
              </div>
              <div className="mt-0.5 font-display text-xs font-bold leading-snug tracking-wide text-slate-100 sm:text-sm lg:text-[15px] [text-wrap:balance]">
                INDIAN INSTITUTE OF INFORMATION TECHNOLOGY, DESIGN AND MANUFACTURING JABALPUR
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Engineering Physics Mechanics · Virtual Laboratory · Experiment No. 08
              </div>
            </div>
          </a>

          {/* Right: Clean Single-Line Navigation + Presentation CTA */}
          <div className="flex flex-wrap items-center justify-between gap-4 lg:justify-end shrink-0">
            <nav
              aria-label="Laboratory Navigation"
              className="flex flex-wrap items-center gap-4 sm:gap-5 text-xs sm:text-sm font-medium text-slate-300"
            >
              <a
                href="#apparatus-window"
                className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
              >
                3D Apparatus
              </a>
              <a
                href="#observation-window"
                className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
              >
                Single-Ball Lab
              </a>
              <a
                href="#graphs-window"
                className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
              >
                Graph Suite
              </a>
              <a
                href="#comparison-window"
                className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
              >
                Analysis
              </a>
              <a
                href="#report-window"
                className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
              >
                Lab Report
              </a>
            </nav>

            <button
              type="button"
              onClick={() => setPresentationOpen(true)}
              className="flex h-10 items-center gap-2 rounded-lg bg-cyan-400 px-4 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Presentation className="h-3.5 w-3.5" />
              <span>Presentation Mode</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main id="top" className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8 space-y-8">
        {/* Homepage Entry Window (Shown initially unless ?autostart=1) */}
        {!isAutostart && (
          <section
            data-testid="homepage-hero"
            className="lab-window lab-hero-enter rounded-2xl p-6 sm:p-8 lg:p-10"
          >
            <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6 flex flex-col justify-between gap-6 lab-hero-slide-left">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-300">
                    <span>Experiment No. 08</span>
                    <span aria-hidden="true">·</span>
                    <span>Single-Ball Sequential Protocol</span>
                    <span aria-hidden="true">·</span>
                    <span>Stokes&apos; Law Verification</span>
                  </div>

                  <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl lg:text-[42px] lg:leading-[1.12] [text-wrap:balance]">
                    STOKES&apos; LAW – INTERACTIVE 3D VIRTUAL PHYSICS LABORATORY
                  </h1>
                  <p className="mt-3 text-base font-medium text-cyan-200/90">
                    Experimental Verification of Stokes&apos; Law and Determination of the Coefficient of Viscosity
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="lab-subpanel rounded-xl p-4">
                      <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-cyan-300">
                        Aim of Experiment
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                        To verify Stokes&apos; Law (<MathFormula tex="v \propto r^2" />) by releasing one sphere at a
                        time through a viscous fluid column, saving sequential trials across sphere radii, applying
                        Ladenburg wall and bottom corrections, and determining the coefficient of viscosity (<MathFormula tex="\eta" />).
                      </p>
                    </div>

                    <div className="lab-subpanel rounded-xl p-4">
                      <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-blue-300">
                        Theoretical Introduction
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                        At steady terminal velocity inside a cylinder of inner radius <MathFormula tex="R" /> and
                        liquid depth <MathFormula tex="H" />, downward weight <MathFormula tex="F_g" /> balances
                        upward buoyancy <MathFormula tex="F_b" /> and viscous drag <MathFormula tex="F_d = 6\pi\eta r v" />:
                      </p>
                      <div className="mt-2.5 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-center">
                        <MathFormula
                          displayMode
                          tex="v = v'\left(1 + 2.4\frac{r}{R}\right)\left(1 + 3.3\frac{r}{H}\right), \qquad \eta = \frac{2(\rho_b - \rho_l)gr^2}{9v}"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={handleStartExperiment}
                    className="flex h-12 items-center gap-2.5 rounded-xl bg-cyan-400 px-6 font-display text-sm font-bold text-slate-950 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Start Experiment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresentationOpen(true)}
                    className="flex h-12 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-5 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Presentation className="h-4 w-4" />
                    <span>Professor View</span>
                  </button>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <ArrowDown className="h-3.5 w-3.5 text-cyan-400" />
                    Scroll down to open live data windows
                  </span>
                </div>
              </div>

              {/* Right: Live 3D Single-Ball Laboratory Preview */}
              <div className="lg:col-span-6 flex flex-col lab-hero-slide-right">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium text-slate-300">Live 3D Single-Ball Apparatus Preview</span>
                  <span className="font-mono">Drag to orbit · Scroll to zoom</span>
                </div>
                <StokesLab3D
                  config={simConfig}
                  compactPreview
                  className="flex-1 lg:h-full"
                />
              </div>
            </div>
          </section>
        )}

        {/* Active Laboratory Workspace Windows (Scroll-revealed windowed sections) */}
        <div ref={labSectionRef} className="space-y-8">
          {/* WINDOW 1: Single-Ball 3D Apparatus & Input Laboratory */}
          <LabWindow
            id="apparatus-window"
            slideDirection="left"
            chapterLabel="Window 01 · Single-Ball 3D Apparatus & Physical Parameters"
            title="Single-Ball 3D Falling-Sphere Simulation & Parameter Workbench"
            subtitle="Configure one active sphere and fluid medium at a time, run the falling-sphere experiment, save each reading sequentially, and adjust parameters freely between trials."
            headerRight={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Velocity Driver:</span>
                <div className="flex flex-wrap max-w-full items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
                  <button
                    type="button"
                    onClick={() => setVelocitySource('live_physics')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      velocitySource === 'live_physics'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Live Stokes Physics
                  </button>
                  <button
                    type="button"
                    onClick={() => setVelocitySource('measured_run')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      velocitySource === 'measured_run'
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Measured Stopwatch (L/T)
                  </button>
                </div>
              </div>
            }
          >
            {/* Global Validation Alerts */}
            {activeAlerts.length > 0 && (
              <div
                role="alert"
                data-testid="physics-warning-banner"
                className={`mb-5 rounded-xl border p-4 text-xs sm:text-sm ${
                  hasCriticalAlert
                    ? 'border-rose-500/50 bg-rose-950/35 text-rose-200'
                    : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {hasCriticalAlert
                        ? activeBallResult.buoyancyCondition !== 'sinking'
                          ? 'Downward Settling Not Applicable (ρb ≤ ρl)'
                          : 'Invalid Apparatus or Sphere Geometry'
                        : activeBallResult.reynoldsStatus === 'invalid' || summary.excludedResults.length > 0
                          ? 'Stokes Regime Validity Notice (High-Re Runs Excluded)'
                          : 'Laboratory Advisory'}
                    </div>
                    {activeAlerts.map((w, i) => (
                      <p key={i} className="text-xs opacity-90">{w}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left 7 cols: Full 3D Single-Ball Stage & Experiment Action Bar */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <StokesLab3D
                  config={simConfig}
                  onSimStatusChange={setSimStatus}
                  onGateTimingSample={setGateTiming}
                  onMarksChange={(nextA, nextB) => handleMarksChange(nextA, nextB)}
                  externalRunSignal={simRunSignal}
                  externalStopSignal={simStopSignal}
                  externalResetSignal={simResetSignal}
                />

                {/* Required Single-Ball Experiment Action Controls */}
                <div
                  data-testid="single-ball-controls"
                  className="rounded-xl border border-sky-400/20 bg-slate-950/75 p-3 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRunExperiment}
                      disabled={simStatus === 'running'}
                      className="flex h-10 items-center gap-1.5 rounded-lg bg-cyan-400 px-4 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Run Experiment</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStopExperiment}
                      disabled={simStatus !== 'running'}
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-950/40 px-3.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/50 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Stop Experiment</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveReading}
                      className="flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      <span>Save Reading</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetCurrentExperiment}
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Current Experiment</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearAllSavedReadings}
                      disabled={savedReadings.length === 0}
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 text-xs font-medium text-rose-200 hover:bg-rose-900/40 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear All Saved Readings ({savedReadings.length})</span>
                    </button>
                  </div>

                  {/* Live Optical-Gate Stopwatch & Save Feedback Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-xs">
                    <div className="flex flex-wrap items-center gap-3 font-mono text-slate-300">
                      <span>
                        Gate Timer (A→B):{' '}
                        <strong className="text-cyan-300">
                          {(gateTiming.completedTransitS ?? gateTiming.elapsedS).toFixed(2)} s
                        </strong>
                      </span>
                      {(gateTiming.completedTransitS !== null || gateTiming.elapsedS > 0.05) && (
                        <button
                          type="button"
                          onClick={handleUseMeasuredGateTime}
                          className="rounded border border-cyan-500/40 bg-cyan-950/40 px-2 py-0.5 font-sans text-[11px] font-medium text-cyan-200 hover:bg-cyan-900/50 transition-colors"
                        >
                          Use Measured Gate Time as T
                        </button>
                      )}
                    </div>

                    {saveFeedback && (
                      <span
                        data-testid="save-reading-feedback"
                        className="font-medium text-emerald-400"
                      >
                        {saveFeedback}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-cyan-400" />
                    <span>
                      Active Medium:{' '}
                      <strong className="text-slate-100">
                        {LIQUID_PRESETS.find((l) => l.id === env.liquidPreset)?.name ?? 'Custom Fluid'}
                      </strong>{' '}
                      (<span className="font-mono">{env.liquidDensityKgM3} kg/m³</span>)
                    </span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pedagogicalRamp}
                      onChange={(e) => setPedagogicalRamp(e.target.checked)}
                      className="h-3.5 w-3.5 accent-cyan-400"
                    />
                    <span>Extended acceleration ramp (visualization aid)</span>
                  </label>
                </div>

                {/* Interactive Optical Gate Markers (Point A & Point B) */}
                <div
                  data-testid="mark-ab-panel"
                  className="lab-subpanel rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-cyan-300">
                        Optical Timing Gates (Mark A &amp; Mark B)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Drag the cyan/blue gate rings directly on the 3D cylinder or adjust positions below — active span L and all readings update live.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="mark-span-readout"
                        className="rounded-lg border border-cyan-500/35 bg-cyan-950/40 px-2.5 py-1 font-mono text-xs font-semibold text-cyan-200"
                      >
                        L = B − A = {(currentMarkBMm - currentMarkAMm).toFixed(1)} mm
                      </span>
                      <button
                        type="button"
                        onClick={handleResetMarks}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-400 hover:text-cyan-200 transition-colors"
                      >
                        Reset A/B
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/65 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="mark-a-input" className="text-xs font-medium text-cyan-300">
                          Mark A Depth (mm from meniscus)
                        </label>
                        <input
                          id="mark-a-input"
                          type="number"
                          min={markBounds.minTopMm}
                          max={Math.max(markBounds.minTopMm, currentMarkBMm - markBounds.minSpanMm)}
                          step={5}
                          value={currentMarkAMm}
                          onChange={(e) =>
                            handleMarksChange(Number(e.target.value), currentMarkBMm, 'A')
                          }
                          className="h-8 w-20 rounded border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <input
                        type="range"
                        aria-label="Mark A depth slider"
                        min={markBounds.minTopMm}
                        max={Math.max(markBounds.minTopMm, currentMarkBMm - markBounds.minSpanMm)}
                        step={1}
                        value={currentMarkAMm}
                        onChange={(e) =>
                          handleMarksChange(Number(e.target.value), currentMarkBMm, 'A')
                        }
                        className="lab-slider w-full"
                      />
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/65 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="mark-b-input" className="text-xs font-medium text-sky-300">
                          Mark B Depth (mm from meniscus)
                        </label>
                        <input
                          id="mark-b-input"
                          type="number"
                          min={Math.min(markBounds.maxBottomMm, currentMarkAMm + markBounds.minSpanMm)}
                          max={markBounds.maxBottomMm}
                          step={5}
                          value={currentMarkBMm}
                          onChange={(e) =>
                            handleMarksChange(currentMarkAMm, Number(e.target.value), 'B')
                          }
                          className="h-8 w-20 rounded border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <input
                        type="range"
                        aria-label="Mark B depth slider"
                        min={Math.min(markBounds.maxBottomMm, currentMarkAMm + markBounds.minSpanMm)}
                        max={markBounds.maxBottomMm}
                        step={1}
                        value={currentMarkBMm}
                        onChange={(e) =>
                          handleMarksChange(currentMarkAMm, Number(e.target.value), 'B')
                        }
                        className="lab-slider w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 5 cols: Comprehensive Parameter Input Workbench (A, B, D) */}
              <div className="lg:col-span-5 space-y-4">
                {/* A. Liquid Properties */}
                <div className="lab-subpanel rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-cyan-300">
                      A. Liquid Properties
                    </h3>
                    <button
                      type="button"
                      onClick={handleSyncActiveTimeToFluid}
                      title="Recalculate ideal stopwatch time T for the active sphere in current fluid"
                      className="flex items-center gap-1 rounded border border-cyan-500/35 bg-cyan-950/40 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-900/50 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Sync Active T to Fluid</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="liquid-preset" className="text-xs text-slate-400 block mb-1">
                        Liquid Preset
                      </label>
                      <select
                        id="liquid-preset"
                        value={env.liquidPreset}
                        onChange={(e) => handleSelectLiquidPreset(e.target.value as LiquidPresetId)}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      >
                        {LIQUID_PRESETS.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.densityKgM3} kg/m³)
                          </option>
                        ))}
                        <option value="custom">Custom Liquid</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="liquid-density" className="text-xs text-slate-400 block mb-1">
                        Liquid Density ρl (kg/m³)
                      </label>
                      <input
                        id="liquid-density"
                        type="number"
                        min={100}
                        max={20000}
                        step={5}
                        value={env.liquidDensityKgM3}
                        onChange={(e) =>
                          handleUpdateEnv({
                            liquidPreset: 'custom',
                            liquidDensityKgM3: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="range"
                      aria-label="Liquid density slider"
                      min={600}
                      max={2000}
                      step={10}
                      value={Math.min(2000, Math.max(600, env.liquidDensityKgM3))}
                      onChange={(e) =>
                        handleUpdateEnv({
                          liquidPreset: 'custom',
                          liquidDensityKgM3: Number(e.target.value),
                        })
                      }
                      className="lab-slider w-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 items-end pt-1">
                    <div>
                      <label htmlFor="ref-viscosity" className="text-xs text-slate-400 block mb-1">
                        Reference η for Theory (Pa·s)
                      </label>
                      <input
                        id="ref-viscosity"
                        type="number"
                        min={0.0001}
                        max={100}
                        step="any"
                        disabled={env.useAutoExperimentalViscosity}
                        value={
                          env.useAutoExperimentalViscosity && summary.averageViscosityPas !== null
                            ? Number(summary.averageViscosityPas.toFixed(4))
                            : env.referenceViscosityPas
                        }
                        onChange={(e) =>
                          handleUpdateEnv({
                            referenceViscosityPas: Math.max(0.0001, Number(e.target.value)),
                          })
                        }
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs text-slate-100 disabled:opacity-55 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 text-xs text-slate-300">
                      <input
                        id="auto-viscosity-checkbox"
                        type="checkbox"
                        checked={env.useAutoExperimentalViscosity}
                        onChange={(e) =>
                          handleUpdateEnv({ useAutoExperimentalViscosity: e.target.checked })
                        }
                        className="h-3.5 w-3.5 accent-cyan-400"
                      />
                      <span className="truncate">Auto-use mean η̄ for theory</span>
                    </label>
                  </div>
                  {env.useAutoExperimentalViscosity && summary.averageViscosityPas === null && (
                    <p className="text-[11px] text-amber-300">
                      {summary.hasMixedFluidConditions
                        ? 'Auto-mean η̄ unavailable while saved dataset spans multiple fluids — falling back to reference η.'
                        : 'No accepted single-fluid saved readings yet — falling back to reference η.'}
                    </p>
                  )}
                </div>

                {/* B. Single Sphere Properties (Radius, Material, Density, Span L, Time T) */}
                <div className="lab-subpanel rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-blue-300">
                      B. Active Single-Ball Properties
                    </h3>
                    <span className="font-mono text-xs text-cyan-300">
                      r = {activeBall.radiusMm.toFixed(2)} mm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ball-material" className="text-xs text-slate-400 block mb-1">
                        Ball Material
                      </label>
                      <select
                        id="ball-material"
                        value={env.ballMaterial}
                        onChange={(e) => handleSelectBallMaterial(e.target.value as BallMaterialId)}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      >
                        {BALL_MATERIAL_PRESETS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.densityKgM3} kg/m³)
                          </option>
                        ))}
                        <option value="custom">Custom Material</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ball-density" className="text-xs text-slate-400 block mb-1">
                        Ball Density ρb (kg/m³)
                      </label>
                      <input
                        id="ball-density"
                        type="number"
                        min={100}
                        max={25000}
                        step={50}
                        value={env.ballDensityKgM3}
                        onChange={(e) =>
                          handleUpdateEnv({
                            ballMaterial: 'custom',
                            ballDensityKgM3: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    aria-label="Ball density slider"
                    min={500}
                    max={16000}
                    step={50}
                    value={Math.min(16000, Math.max(500, env.ballDensityKgM3))}
                    onChange={(e) =>
                      handleUpdateEnv({
                        ballMaterial: 'custom',
                        ballDensityKgM3: Number(e.target.value),
                      })
                    }
                    className="lab-slider w-full"
                  />

                  {/* Single Sphere Radius & Presets */}
                  <div className="border-t border-slate-800/80 pt-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="active-ball-radius" className="text-xs text-slate-300 font-medium">
                        Sphere Radius r (mm)
                      </label>
                      <div className="flex items-center gap-1">
                        {RADIUS_PRESETS_MM.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleUpdateActiveBall({ radiusMm: p })}
                            className={`rounded px-2 py-1 font-mono text-[10px] transition-colors ${
                              Math.abs(activeBall.radiusMm - p) < 0.01
                                ? 'bg-cyan-400 text-slate-950 font-semibold'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-100'
                            }`}
                          >
                            {p}mm
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center">
                      <input
                        id="active-ball-radius"
                        type="number"
                        min={0.1}
                        max={25}
                        step={0.1}
                        value={activeBall.radiusMm}
                        onChange={(e) =>
                          handleUpdateActiveBall({
                            radiusMm: Math.max(0.05, Number(e.target.value)),
                          })
                        }
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      />
                      <div className="col-span-2">
                        <input
                          type="range"
                          aria-label="Active sphere radius slider"
                          min={0.5}
                          max={4.5}
                          step={0.1}
                          value={Math.min(4.5, Math.max(0.5, activeBall.radiusMm))}
                          onChange={(e) =>
                            handleUpdateActiveBall({ radiusMm: Number(e.target.value) })
                          }
                          className="lab-slider w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* D. Cylinder Properties & Gravity */}
                <div className="lab-subpanel rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-slate-100">
                      C. Cylinder Dimensions &amp; Gravity (Ladenburg)
                    </h3>
                    <span className="font-mono text-xs text-cyan-300">
                      R = {innerRadiusMm.toFixed(2)} mm
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cyl-diameter" className="text-xs text-slate-400 block mb-1">
                        Inner Diameter D (mm)
                      </label>
                      <input
                        id="cyl-diameter"
                        type="number"
                        min={10}
                        max={500}
                        step={1}
                        value={env.cylinderDiameterMm}
                        onChange={(e) =>
                          handleUpdateEnv({
                            cylinderDiameterMm: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="col-height" className="text-xs text-slate-400 block mb-1">
                        Column Height H (mm)
                      </label>
                        <input
                        id="col-height"
                        type="number"
                        min={50}
                        max={2000}
                        step={5}
                        value={env.columnHeightMm}
                        onChange={(e) => {
                          const nextH = Math.max(50, Number(e.target.value));
                          const clampedMarks = clampMarkPositions({
                            markAMm: env.markAMm ?? 80,
                            markBMm: env.markBMm ?? 330,
                            columnHeightMm: nextH,
                            changed: 'H',
                          });
                          handleUpdateEnv({
                            columnHeightMm: nextH,
                            markAMm: clampedMarks.markAMm,
                            markBMm: clampedMarks.markBMm,
                            defaultMarkDistanceMm: clampedMarks.spanMm,
                          });
                          setActiveBall((prev) => ({ ...prev, lengthMm: clampedMarks.spanMm }));
                        }}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="mark-dist" className="text-xs text-slate-400 block mb-1">
                        Default Mark Span L (mm)
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          id="mark-dist"
                          type="number"
                          min={10}
                          max={1500}
                          step={5}
                          value={env.defaultMarkDistanceMm}
                          onChange={(e) =>
                            handleUpdateEnv({
                              defaultMarkDistanceMm: Math.max(1, Number(e.target.value)),
                            })
                          }
                          className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleApplyDefaultSpan}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-[11px] font-medium text-slate-200 hover:border-cyan-400 whitespace-nowrap"
                        >
                          Apply
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="gravity-input" className="text-xs text-slate-400 block mb-1">
                        Gravity g (m/s²)
                      </label>
                      <input
                        id="gravity-input"
                        type="number"
                        min={0.1}
                        max={50}
                        step={0.01}
                        value={env.gravityMs2}
                        onChange={(e) =>
                          handleUpdateEnv({
                            gravityMs2: Math.max(0.1, Number(e.target.value)),
                          })
                        }
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </LabWindow>

          {/* WINDOW 2: Single-Ball Observation, Exact Calculations & Sequential Saved Readings */}
          <LabWindow
            id="observation-window"
            slideDirection="right"
            chapterLabel="Window 02 · Single-Ball Live Calculations & Sequential Readings Dataset"
            title="Single-Ball Observation, Ladenburg Corrections & Saved Trials"
            subtitle="Perform one falling-sphere measurement at a time, inspect exact step-by-step calculations, then save readings sequentially to build your v vs r² dataset."
            headerRight={
              <div className="flex flex-wrap items-center gap-3">
                <div className="font-mono text-xs text-slate-300">
                  Saved Dataset: <strong className="text-cyan-300">{savedReadings.length}</strong>{' '}
                  {savedReadings.length === 1 ? 'Reading' : 'Readings'}
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
                  <span className="px-2 text-slate-400">L Unit:</span>
                  {(['mm', 'cm'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setLengthUnit(u)}
                      className={`rounded px-2 py-1 font-mono ${
                        lengthUnit === u ? 'bg-blue-600 text-white' : 'text-slate-300'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {/* Reference vs Manual Stopwatch Indicator for Active Sphere */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/55 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    !isTimeManual ? 'bg-cyan-400' : 'bg-amber-400'
                  }`}
                />
                {!isTimeManual ? (
                  <span>
                    <strong className="text-cyan-300">Auto-Synced Reference Trial:</strong> Active sphere time T follows Stokes + Ladenburg theory for η ={' '}
                    {(activeBallEtaRef ?? env.referenceViscosityPas).toFixed(4)} Pa·s
                    {env.useAutoExperimentalViscosity && summary.averageViscosityPas !== null
                      ? ' (synced to dataset mean η̄)'
                      : ''}
                    . Edit T manually or capture the gate timer to enter custom readings.
                  </span>
                ) : (
                  <span>
                    <strong className="text-amber-300">
                      Manual Stopwatch Reading (T = {activeBall.timeS < 0.1 ? activeBall.timeS.toFixed(5) : activeBall.timeS.toFixed(3)} s):
                    </strong>{' '}
                    Calculations reflect your custom time entry.
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Accepted: <strong className="text-emerald-400">{summary.acceptedResults.length}</strong> · Excluded: <strong className={summary.excludedResults.length > 0 ? 'text-rose-400' : 'text-slate-300'}>{summary.excludedResults.length}</strong>
              </div>
            </div>

            {/* Active Single-Ball Observation Row */}
            <div className="overflow-x-auto rounded-xl border border-cyan-500/30 bg-slate-950/65">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/70 text-slate-300">
                    <th className="py-3 pl-4 pr-2 font-semibold">Active Experiment</th>
                    <th className="py-3 px-2 font-semibold">Radius r (mm)</th>
                    <th className="py-3 px-2 font-semibold">Distance L ({lengthUnit})</th>
                    <th className="py-3 px-2 font-semibold">Stopwatch Time T (s)</th>
                    <th className="py-3 px-2 font-semibold text-right">Observed v&apos; (m/s)</th>
                    <th className="py-3 px-2 font-semibold text-right">C_L (f₁·f₂)</th>
                    <th className="py-3 px-2 font-semibold text-right">Corrected v (m/s)</th>
                    <th className="py-3 px-2 font-semibold text-right">Viscosity η (Pa·s)</th>
                    <th className="py-3 px-2 font-semibold text-right">Re &amp; Regime</th>
                    <th className="py-3 pl-2 pr-4 font-semibold text-right">Trial Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-cyan-950/15" data-testid="active-single-ball-row">
                    <td className="py-3.5 pl-4 pr-2 font-display font-semibold text-cyan-200 whitespace-nowrap">
                      Active Single Sphere
                    </td>

                    <td className="py-3.5 px-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="number"
                          aria-label="Active sphere radius in mm"
                          min={0.1}
                          max={25}
                          step={0.1}
                          value={activeBall.radiusMm}
                          onChange={(e) =>
                            handleUpdateActiveBall({
                              radiusMm: Math.max(0.05, Number(e.target.value)),
                            })
                          }
                          className="h-8 w-20 rounded border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                        />
                        <div className="flex items-center gap-1">
                          {RADIUS_PRESETS_MM.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handleUpdateActiveBall({ radiusMm: p })}
                              className={`rounded px-1.5 py-1 font-mono text-[10px] transition-colors ${
                                Math.abs(activeBall.radiusMm - p) < 0.01
                                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                                  : 'bg-slate-900 text-slate-400 hover:text-slate-100'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-2">
                      <div className="space-y-1">
                        <input
                          type="number"
                          aria-label={`Active sphere travel distance L in ${lengthUnit}`}
                          min={0.5}
                          max={2000}
                          step={lengthUnit === 'cm' ? 0.5 : 5}
                          value={
                            lengthUnit === 'cm'
                              ? Number((activeBall.lengthMm / 10).toFixed(2))
                              : activeBall.lengthMm
                          }
                          onChange={(e) => {
                            const val = Math.max(0.1, Number(e.target.value));
                            const nextLenMm = lengthUnit === 'cm' ? val * 10 : val;
                            const synced = computeMarksForSpan({
                              markAMm: env.markAMm ?? 80,
                              targetSpanMm: nextLenMm,
                              columnHeightMm: env.columnHeightMm,
                            });
                            setEnv((prev) => ({
                              ...prev,
                              markAMm: synced.markAMm,
                              markBMm: synced.markBMm,
                              defaultMarkDistanceMm: nextLenMm,
                            }));
                            handleUpdateActiveBall({ lengthMm: nextLenMm });
                          }}
                          className="h-8 w-20 rounded border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                        />
                        <div className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                          A {currentMarkAMm.toFixed(0)}→B {currentMarkBMm.toFixed(0)} mm
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          aria-label="Active sphere stopwatch time T in seconds"
                          min={0.0001}
                          max={600}
                          step="any"
                          value={activeBall.timeS}
                          onChange={(e) =>
                            handleUpdateActiveBall(
                              { timeS: Math.max(0.0001, Number(e.target.value)) },
                              true,
                            )
                          }
                          className="h-8 w-24 rounded border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                        />
                        {isTimeManual && (
                          <button
                            type="button"
                            onClick={handleSyncActiveTimeToFluid}
                            className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] text-cyan-300 hover:border-cyan-400 whitespace-nowrap"
                          >
                            Auto T
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-2 text-right font-mono text-slate-300">
                      {activeBallResult.observedVelocityMs.toFixed(5)}
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono text-slate-300">
                      {activeBallResult.combinedCorrectionCL.toFixed(4)}
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono font-semibold text-cyan-300">
                      {activeBallResult.netSettlingPossible
                        ? activeBallResult.correctedVelocityMs.toFixed(5)
                        : '—'}
                    </td>
                    <td
                      className="py-3.5 px-2 text-right font-mono font-bold text-slate-100"
                      data-testid="active-ball-viscosity"
                    >
                      {activeBallResult.viscosityPas !== null
                        ? activeBallResult.viscosityPas.toFixed(4)
                        : 'N/A'}
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono">
                      {activeBallResult.reynoldsNumber !== null ? (
                        <div className="flex flex-col items-end">
                          <span
                            className={
                              activeBallResult.reynoldsStatus === 'valid'
                                ? 'text-emerald-400'
                                : activeBallResult.reynoldsStatus === 'caution'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }
                          >
                            {activeBallResult.reynoldsNumber.toFixed(3)}
                          </span>
                          <span className="font-sans text-[10px] text-slate-400">
                            {activeBallResult.reynoldsStatus === 'valid'
                              ? 'Valid'
                              : activeBallResult.reynoldsStatus === 'caution'
                                ? 'Caution'
                                : 'Excluded'}
                          </span>
                        </div>
                      ) : (
                        <span className="font-sans text-[10px] text-rose-400">
                          {activeBallResult.buoyancyCondition === 'neutral'
                            ? 'Neutral'
                            : activeBallResult.buoyancyCondition === 'floating'
                              ? 'Floats'
                              : 'Invalid'}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 pl-2 pr-4 text-right">
                      <button
                        type="button"
                        onClick={handleSaveReading}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
                      >
                        <BookmarkPlus className="h-3 w-3" />
                        <span>Save Reading</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Step-by-Step Mathematical Derivation for Active Single Ball */}
            <div className="mt-6 lab-subpanel rounded-xl p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-slate-100">
                  Step-by-Step Mathematical Derivation — Active Single Sphere (r = {activeBallResult.radiusMm} mm)
                </h3>
                <div className="flex items-center gap-1.5 text-xs">
                  {activeBallResult.reynoldsStatus === 'valid' ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Stokes Regime Valid (Re &lt; 0.5)
                    </span>
                  ) : activeBallResult.reynoldsStatus === 'caution' ? (
                    <span className="text-amber-400 font-medium">
                      ▲ Transitional Regime (0.5 ≤ Re &lt; 1.0)
                    </span>
                  ) : activeBallResult.reynoldsStatus === 'invalid' ? (
                    <span className="text-rose-400 font-medium">
                      ✖ Inertial Regime (Re ≥ 1.0 · Stokes Approximation Exceeded)
                    </span>
                  ) : (
                    <span className="text-rose-400 font-medium">
                      ✖ Settling Invalid (ρb ≤ ρl)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-cyan-300">Step 1: Observed Velocity</div>
                  <MathFormula tex="v' = \frac{L}{T}" displayMode />
                  <div className="font-mono text-xs text-slate-300 space-y-0.5">
                    <div>L = {activeBallResult.lengthM.toFixed(4)} m</div>
                    <div>T = {activeBallResult.timeS < 0.1 ? activeBallResult.timeS.toFixed(5) : activeBallResult.timeS.toFixed(3)} s</div>
                    <div className="text-slate-100 font-semibold">
                      v&apos; = {activeBallResult.observedVelocityMs.toFixed(5)} m/s
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-cyan-300">Step 2: Ladenburg Correction</div>
                  <MathFormula tex="v = v'\left(1+2.4\frac{r}{R}\right)\left(1+3.3\frac{r}{H}\right)" displayMode />
                  <div className="font-mono text-xs text-slate-300 space-y-0.5">
                    <div>f₁ (Wall) = {activeBallResult.wallCorrectionF1.toFixed(5)}</div>
                    <div>f₂ (Bottom) = {activeBallResult.bottomCorrectionF2.toFixed(5)}</div>
                    <div>Combined C_L = {activeBallResult.combinedCorrectionCL.toFixed(5)}</div>
                    <div className="text-cyan-300 font-semibold">
                      v = {activeBallResult.netSettlingPossible ? activeBallResult.correctedVelocityMs.toFixed(5) : '—'} m/s
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-blue-300">Step 3: Theoretical Stokes Velocity</div>
                  <MathFormula tex="v_{\text{th}} = \frac{2(\rho_b - \rho_l)gr^2}{9\eta}" displayMode />
                  <div className="font-mono text-xs text-slate-300 space-y-0.5">
                    <div>Δρ = {env.ballDensityKgM3 - env.liquidDensityKgM3} kg/m³</div>
                    <div>
                      η_ref ={' '}
                      {activeBallEtaRef !== null
                        ? `${activeBallEtaRef.toFixed(4)} Pa·s`
                        : '—'}
                    </div>
                    <div className="text-blue-300 font-semibold">
                      v_th ={' '}
                      {activeBallResult.theoreticalVelocityMs !== null
                        ? `${activeBallResult.theoreticalVelocityMs.toFixed(5)} m/s`
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-emerald-300">Step 4: Experimental Viscosity &amp; Re</div>
                  <MathFormula tex="\eta = \frac{2(\rho_b - \rho_l)gr^2}{9v}" displayMode />
                  <div className="font-mono text-xs text-slate-300 space-y-0.5">
                    <div>r² = {activeBallResult.radiusSqM2.toExponential(3)} m²</div>
                    <div className="text-emerald-300 font-semibold">
                      η ={' '}
                      {activeBallResult.viscosityPas !== null
                        ? `${activeBallResult.viscosityPas.toFixed(4)} Pa·s`
                        : 'N/A'}
                    </div>
                    <div>
                      Re ={' '}
                      {activeBallResult.reynoldsNumber !== null
                        ? activeBallResult.reynoldsNumber.toFixed(4)
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sequential Saved Readings Dataset Log (Separate from Active Ball) */}
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-100">
                    Saved Sequential Readings Dataset ({savedReadings.length} {savedReadings.length === 1 ? 'Trial' : 'Trials'})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Each completed single-ball experiment can be saved here independently to build the <MathFormula tex="v \text{ vs } r^2" /> regression curve.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {summary.hasMixedMediumConditions && (
                    <button
                      type="button"
                      onClick={handleKeepActiveMediumReadings}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-500/45 bg-amber-950/40 px-3 text-xs font-medium text-amber-200 hover:bg-amber-900/50 transition-colors whitespace-nowrap"
                    >
                      <span>Keep Only Active Medium</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSyncDatasetToFluid}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Load 4-Trial Set for Current Fluid</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllSavedReadings}
                    disabled={savedReadings.length === 0}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 text-xs font-medium text-rose-200 hover:bg-rose-900/40 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear All Saved Readings</span>
                  </button>
                </div>
              </div>

              {summary.hasMixedMediumConditions && (
                <div
                  data-testid="mixed-conditions-notice"
                  className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-3.5 py-2.5 text-xs text-amber-200"
                >
                  {summary.hasMixedFluidConditions
                    ? 'Mixed fluid conditions detected in saved trials: pooled mean η̄ and single-line v vs r² regression are disabled so incompatible liquids are never averaged together.'
                    : 'Mixed sphere densities or gravities detected in saved trials: single-line v vs r² regression (η_graph, R²) is disabled because slope m depends on (ρb − ρl)g.'}
                </div>
              )}

              {savedReadings.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/55">
                  <table className="w-full min-w-[920px] text-left text-xs" data-testid="saved-readings-table">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-300">
                        <th className="py-2.5 pl-4 pr-2 font-semibold">Reading</th>
                        <th className="py-2.5 px-2 font-semibold">Medium &amp; Densities</th>
                        <th className="py-2.5 px-2 font-semibold text-right">r (mm)</th>
                        <th className="py-2.5 px-2 font-semibold text-right">L ({lengthUnit})</th>
                        <th className="py-2.5 px-2 font-semibold text-right">T (s)</th>
                        <th className="py-2.5 px-2 font-semibold text-right">v&apos; (m/s)</th>
                        <th className="py-2.5 px-2 font-semibold text-right">C_L</th>
                        <th className="py-2.5 px-2 font-semibold text-right">Corrected v (m/s)</th>
                        <th className="py-2.5 px-2 font-semibold text-right">η (Pa·s)</th>
                        <th className="py-2.5 px-2 font-semibold text-right">Re &amp; Status</th>
                        <th className="py-2.5 pl-2 pr-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {summary.results.map((res, idx) => {
                        const raw = savedReadings[idx];
                        const displayL =
                          lengthUnit === 'cm'
                            ? (raw.lengthMm / 10).toFixed(2)
                            : raw.lengthMm.toFixed(1);
                        return (
                          <tr key={raw.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 pl-4 pr-2 font-display font-semibold text-slate-100 whitespace-nowrap">
                              {raw.label}
                            </td>
                            <td className="py-2.5 px-2 text-slate-400 whitespace-nowrap">
                              <div>{raw.liquidName}</div>
                              <div className="font-mono text-[10px]">
                                ρb={raw.ballDensityKgM3} · ρl={raw.liquidDensityKgM3}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-200">
                              {raw.radiusMm.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                              {displayL}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                              {raw.timeS < 0.1 ? raw.timeS.toFixed(5) : raw.timeS.toFixed(3)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                              {res.observedVelocityMs.toFixed(5)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                              {res.combinedCorrectionCL.toFixed(4)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-semibold text-cyan-300">
                              {res.netSettlingPossible ? res.correctedVelocityMs.toFixed(5) : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-100">
                              {res.viscosityPas !== null ? res.viscosityPas.toFixed(4) : 'N/A'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              {res.reynoldsNumber !== null ? (
                                <span
                                  className={
                                    res.reynoldsStatus === 'valid'
                                      ? 'text-emerald-400'
                                      : res.reynoldsStatus === 'caution'
                                        ? 'text-amber-400'
                                        : 'text-rose-400'
                                  }
                                >
                                  {res.reynoldsNumber.toFixed(3)} (
                                  {res.reynoldsStatus === 'valid'
                                    ? 'Valid'
                                    : res.reynoldsStatus === 'caution'
                                      ? 'Caution'
                                      : 'Excluded'}
                                  )
                                </span>
                              ) : (
                                <span className="text-rose-400">
                                  {res.buoyancyCondition === 'neutral' ? 'Neutral' : 'Floats'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleLoadReadingIntoActive(raw)}
                                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
                                >
                                  Load
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReading(raw.id)}
                                  aria-label={`Remove ${raw.label}`}
                                  className="rounded border border-rose-500/30 bg-rose-950/30 px-2 py-1 text-[10px] font-medium text-rose-300 hover:bg-rose-900/40 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  data-testid="empty-saved-readings"
                  className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-xs text-slate-400"
                >
                  No saved readings yet. Configure a sphere radius above, run the experiment, and click{' '}
                  <strong className="text-cyan-300">Save Reading</strong> to record sequential trials.
                </div>
              )}
            </div>

            {/* Summary KPI Strip */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
                <div className="text-xs text-slate-400">
                  Active Sphere η (r = {activeBallResult.radiusMm} mm)
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-slate-100">
                  {activeBallResult.viscosityPas !== null
                    ? activeBallResult.viscosityPas.toFixed(4)
                    : '—'}
                  <span className="ml-1 text-xs font-normal text-slate-400">Pa·s</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                  v = {activeBallResult.netSettlingPossible ? activeBallResult.correctedVelocityMs.toFixed(4) : '—'} m/s
                </div>
              </div>

              <div className="rounded-xl border border-cyan-400/40 bg-cyan-950/30 p-3.5">
                <div className="text-xs font-medium text-cyan-300">
                  Dataset Mean Viscosity (η̄)
                </div>
                <div
                  className="mt-1 font-mono text-xl font-bold text-cyan-200"
                  data-testid="average-viscosity-value"
                >
                  {summary.averageViscosityPas !== null
                    ? summary.averageViscosityPas.toFixed(4)
                    : '—'}
                  <span className="ml-1 text-xs font-normal text-cyan-300/80">Pa·s</span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300">
                  {summary.hasMixedFluidConditions ? (
                    <span className="text-amber-300">Disabled: mixed fluids in dataset</span>
                  ) : (
                    <>
                      Mean of {summary.validViscosityCount} accepted {summary.validViscosityCount === 1 ? 'reading' : 'readings'}
                      {summary.excludedResults.length > 0 && (
                        <span className="text-rose-300"> ({summary.excludedResults.length} excluded)</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
                <div className="text-xs text-slate-400">Graph-Derived Viscosity (η_graph)</div>
                <div className="mt-1 font-mono text-xl font-bold text-blue-300" data-testid="kpi-graph-viscosity">
                  {summary.graphDerivedViscosityPas !== null
                    ? summary.graphDerivedViscosityPas.toFixed(4)
                    : '—'}
                  <span className="ml-1 text-xs font-normal text-slate-400">Pa·s</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                  {summary.graphSlopePerMS !== null
                    ? `Slope m = ${summary.graphSlopePerMS.toFixed(1)} m⁻¹s⁻¹`
                    : summary.rSquaredStatus === 'mixed_conditions'
                      ? 'Disabled (mixed medium)'
                      : 'Slope unavailable'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
                <div className="text-xs text-slate-400">Stokes Linearity (R²)</div>
                <div className="mt-1 font-mono text-xl font-bold text-emerald-400" data-testid="kpi-rsquared-value">
                  {summary.graphRSquared !== null
                    ? summary.graphRSquared.toFixed(5)
                    : summary.rSquaredStatus === 'mixed_conditions'
                      ? 'N/A (mixed)'
                      : summary.rSquaredStatus === 'same_radius'
                        ? 'N/A (1 radius)'
                        : '—'}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {summary.rSquaredStatus === 'valid'
                    ? `Verified across ${summary.acceptedResults.length} saved trials`
                    : summary.rSquaredStatus === 'mixed_conditions'
                      ? 'Single-line fit disabled for mixed media'
                      : summary.rSquaredStatus === 'same_radius'
                        ? 'Save trials at ≥ 2 distinct radii'
                        : 'Save ≥ 2 valid readings at varied radii'}
                </div>
              </div>
            </div>

            {/* Physical Concepts & Assumptions Reference */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 text-xs leading-relaxed text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <h4 className="font-display text-sm font-semibold text-slate-100 mb-1.5">
                  Stokes&apos; Law Assumptions
                </h4>
                <p>
                  Assumes an incompressible, homogeneous Newtonian fluid of infinite extent, rigid smooth spherical
                  particle, no-slip fluid boundary, and creeping laminar flow (<MathFormula tex="Re \ll 1" />) where inertial acceleration is negligible compared to viscous shear.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <h4 className="font-display text-sm font-semibold text-slate-100 mb-1.5">
                  Force Balance &amp; Terminal Velocity
                </h4>
                <p>
                  At release (<MathFormula tex="t=0" />), <MathFormula tex="v=0" /> and viscous drag{' '}
                  <MathFormula tex="F_d=0" />. As speed rises, <MathFormula tex="F_d=6\pi\eta r v" /> grows until{' '}
                  <MathFormula tex="F_b + F_d = F_g" />, yielding zero net acceleration and constant terminal velocity.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <h4 className="font-display text-sm font-semibold text-slate-100 mb-1.5">
                  Why Ladenburg Corrections Matter
                </h4>
                <p>
                  Fluid displaced by the falling sphere must return upward through the narrow annulus between sphere
                  and cylinder walls (<MathFormula tex="R" />) and slows near the jar bottom (<MathFormula tex="H" />),
                  increasing drag and reducing observed speed <MathFormula tex="v'" />.
                </p>
              </div>
            </div>
          </LabWindow>

          {/* WINDOW 3: Scientific Graph Laboratory */}
          <LabWindow
            id="graphs-window"
            slideDirection="left"
            chapterLabel="Window 03 · Regression Diagnostics & Kinematic Curves"
            title="Scientific Graph Laboratory"
            subtitle="Interactive Chart.js visualizations updating instantaneously from your sequentially saved single-ball readings and active sphere kinematics."
          >
            <ScientificGraphs
              summary={summary}
              env={env}
              selectedBall={activeBallResult}
              velocitySource={velocitySource}
              activeViscosityPas={activeViscosityForSim}
              pedagogicalRamp={pedagogicalRamp}
            />
          </LabWindow>

          {/* WINDOW 4: Experiment Comparison & Sensitivity Analysis */}
          <LabWindow
            id="comparison-window"
            slideDirection="right"
            chapterLabel="Window 04 · Parameter Sweeps & Scaling Laws"
            title="Parameter Sensitivity & Scaling Analysis"
            subtitle="Compare the active single-ball trial with your sequential dataset, explore density contrast effects, and verify quadratic velocity scaling (v ∝ r²)."
          >
            <ComparisonLab
              summary={summary}
              activeBallResult={activeBallResult}
              env={env}
              activeViscosityPas={activeViscosityForSim}
            />
          </LabWindow>

          {/* WINDOW 5: Complete Practical Lab Report */}
          <LabWindow
            id="report-window"
            slideDirection="left"
            chapterLabel="Window 05 · Formal College Practical Record"
            title="Complete Experiment 08 Report, Conclusion & Data Export"
            subtitle="Ready for IIITDM Jabalpur laboratory submission, CSV archival, or PDF printing via browser print."
          >
            <LabReport
              summary={summary}
              activeBallResult={activeBallResult}
              env={env}
            />
          </LabWindow>
        </div>
      </main>

      {/* Cinematic NASA-Inspired Closing Section with IIITDM Jabalpur & Single Developer Credit */}
      <InstitutionalFooter />

      {/* Professor Fullscreen Presentation Cockpit */}
      <PresentationMode
        isOpen={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        env={env}
        onUpdateEnv={handleUpdateEnv}
        activeBall={activeBall}
        onUpdateActiveBall={(patch) => handleUpdateActiveBall(patch, 'timeS' in patch)}
        activeBallResult={activeBallResult}
        summary={summary}
        onSaveReading={handleSaveReading}
        simConfig={simConfig}
      />
    </div>
  );
}
