import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  ScatterController,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartConfiguration,
} from 'chart.js';
import {
  computePredictedTimeS,
  evaluateFallKinematics,
  type BallCalculationResult,
  type ExperimentSummary,
  type LabEnvironment,
} from '../physics/stokes';
import { MathFormula } from './MathFormula';

Chart.register(
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  ScatterController,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface ScientificGraphsProps {
  summary: ExperimentSummary;
  env: LabEnvironment;
  selectedBall: BallCalculationResult;
  velocitySource?: 'live_physics' | 'measured_run';
  activeViscosityPas?: number;
  pedagogicalRamp?: boolean;
  compactSingleChart?: boolean;
}

function ChartCanvas({
  config,
  heightClass = 'h-72',
  testId,
}: {
  config: ChartConfiguration;
  heightClass?: string;
  testId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    chartRef.current = new Chart(canvas, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config]);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} data-testid={testId} />
    </div>
  );
}

const CHART_GRID_COLOR = 'rgba(148, 163, 184, 0.14)';
const CHART_TICK_COLOR = '#94a3b8';

export function PrimaryVR2Chart({
  summary,
  showObservedOverlay = true,
  heightClass = 'h-80',
}: {
  summary: ExperimentSummary;
  showObservedOverlay?: boolean;
  heightClass?: string;
}) {
  const validResults = useMemo(
    () => summary.acceptedResults.filter((r) => r.reynoldsStatus === 'valid'),
    [summary.acceptedResults],
  );
  const cautionResults = useMemo(
    () => summary.acceptedResults.filter((r) => r.reynoldsStatus === 'caution'),
    [summary.acceptedResults],
  );
  const excludedPlotResults = useMemo(
    () =>
      summary.excludedResults.filter(
        (r) =>
          r.validationErrors.length === 0 &&
          r.netSettlingPossible &&
          r.correctedVelocityMs > 0,
      ),
    [summary.excludedResults],
  );

  const config = useMemo<ChartConfiguration>(() => {
    const allPlotted = [...summary.acceptedResults, ...excludedPlotResults];
    const maxR2Mm2 = Math.max(10, ...allPlotted.map((r) => r.radiusSqMm2 * 1.15));
    const slopePerMm2 = summary.graphSlopeDisplayMm2PerS ?? 0;

    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        type: 'scatter',
        label: 'Saved Stokes v (Re < 0.5)',
        data: validResults.map((r) => ({ x: r.radiusSqMm2, y: r.correctedVelocityMs })),
        backgroundColor: '#22d3ee',
        borderColor: '#083344',
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ];

    if (cautionResults.length > 0) {
      datasets.push({
        type: 'scatter',
        label: 'Caution Saved v (0.5 ≤ Re < 1.0)',
        data: cautionResults.map((r) => ({ x: r.radiusSqMm2, y: r.correctedVelocityMs })),
        backgroundColor: '#f59e0b',
        borderColor: '#451a03',
        borderWidth: 1.5,
        pointRadius: 6.5,
        pointHoverRadius: 8.5,
        pointStyle: 'rectRot',
      });
    }

    if (summary.acceptedResults.length > 0 && summary.graphSlopeDisplayMm2PerS !== null) {
      datasets.push({
        type: 'line',
        label:
          summary.acceptedResults.length >= 2
            ? 'Stokes Origin Fit (v = m·r², saved trials)'
            : 'Single-Reading Origin Line (need ≥ 2 for R²)',
        data: [
          { x: 0, y: 0 },
          { x: maxR2Mm2, y: slopePerMm2 * maxR2Mm2 },
        ],
        borderColor: '#3b82f6',
        borderWidth: 2.5,
        borderDash: summary.acceptedResults.length < 2 ? [6, 4] : undefined,
        pointRadius: 0,
        tension: 0,
      });
    }

    if (excludedPlotResults.length > 0) {
      datasets.push({
        type: 'scatter',
        label: 'Excluded Inertial Reading (Re ≥ 1.0)',
        data: excludedPlotResults.map((r) => ({ x: r.radiusSqMm2, y: r.correctedVelocityMs })),
        backgroundColor: '#f43f5e',
        borderColor: '#fb7185',
        borderWidth: 2,
        pointRadius: 7,
        pointHoverRadius: 9,
        pointStyle: 'crossRot',
      });
    }

    if (showObservedOverlay && summary.acceptedResults.length > 0) {
      datasets.push({
        type: 'scatter',
        label: "Observed Uncorrected v' (saved trials)",
        data: summary.acceptedResults.map((r) => ({ x: r.radiusSqMm2, y: r.observedVelocityMs })),
        backgroundColor: '#94a3b8',
        borderColor: '#1e293b',
        borderWidth: 1.5,
        pointRadius: 5,
        pointStyle: 'triangle',
      });
    }

    return {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Public Sans', size: 11 } },
          },
          tooltip: {
            backgroundColor: '#091022',
            borderColor: 'rgba(56, 189, 248, 0.35)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            callbacks: {
              label: (ctx) => {
                const pt = ctx.raw as { x: number; y: number };
                return `${ctx.dataset.label}: r² = ${pt.x.toFixed(2)} mm², v = ${pt.y.toFixed(5)} m/s`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            title: {
              display: true,
              text: 'Radius Squared, r² (mm²)  [1 mm² = 10⁻⁶ m²]',
              color: '#cbd5e1',
              font: { family: 'Public Sans', size: 12, weight: 'bold' },
            },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR, font: { family: 'JetBrains Mono', size: 11 } },
          },
          y: {
            type: 'linear',
            min: 0,
            title: {
              display: true,
              text: 'Terminal Velocity, v (m/s)',
              color: '#cbd5e1',
              font: { family: 'Public Sans', size: 12, weight: 'bold' },
            },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR, font: { family: 'JetBrains Mono', size: 11 } },
          },
        },
      },
    };
  }, [
    validResults,
    cautionResults,
    excludedPlotResults,
    summary.acceptedResults,
    summary.graphSlopeDisplayMm2PerS,
    showObservedOverlay,
  ]);

  return (
    <div className="space-y-2">
      <ChartCanvas config={config} heightClass={heightClass} testId="vr2-chart" />
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-1.5 text-[11px] font-mono text-slate-300"
        data-testid="vr2-regime-status"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-emerald-400">
            Valid (Re&lt;0.5): {validResults.length}
          </span>
          <span className="text-amber-400">
            Caution (0.5≤Re&lt;1): {cautionResults.length}
          </span>
          <span className="text-rose-400">
            Excluded (Re≥1 / invalid): {summary.excludedResults.length}
          </span>
        </div>
        {summary.regressionInsufficientData && (
          <span className="text-amber-300">
            {summary.rSquaredStatus === 'mixed_conditions'
              ? 'Mixed conditions — single-line regression disabled'
              : summary.rSquaredStatus === 'same_radius'
                ? 'Need ≥ 2 distinct radii to compute R²'
                : summary.results.length === 0
                  ? 'No saved readings yet — save single-ball trials to plot'
                  : summary.acceptedResults.length === 0
                    ? 'No valid Stokes points for regression'
                    : 'Need ≥ 2 saved readings to compute R²'}
          </span>
        )}
      </div>
    </div>
  );
}

export function ScientificGraphs({
  summary,
  env,
  selectedBall,
  velocitySource = 'live_physics',
  activeViscosityPas,
  pedagogicalRamp = true,
  compactSingleChart = false,
}: ScientificGraphsProps) {
  const [showObservedOverlay, setShowObservedOverlay] = useState(true);

  const acceptedResults = summary.acceptedResults;
  const validResults = useMemo(
    () => acceptedResults.filter((r) => r.reynoldsStatus === 'valid'),
    [acceptedResults],
  );
  const cautionResults = useMemo(
    () => acceptedResults.filter((r) => r.reynoldsStatus === 'caution'),
    [acceptedResults],
  );
  const excludedValidGeom = useMemo(
    () =>
      summary.excludedResults.filter(
        (r) => r.validationErrors.length === 0 && r.netSettlingPossible,
      ),
    [summary.excludedResults],
  );

  // Graph 2: Observed vs Corrected Velocity comparison (fits strictly over accepted Stokes points)
  const observedVsCorrectedConfig = useMemo<ChartConfiguration>(() => {
    const obsSlopeMm2 =
      summary.observedGraphSlopePerMS !== null ? summary.observedGraphSlopePerMS * 1e-6 : 0;
    const corSlopeMm2 = summary.graphSlopeDisplayMm2PerS ?? 0;
    const maxR2 = Math.max(10, ...acceptedResults.map((r) => r.radiusSqMm2 * 1.12));

    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        type: 'scatter',
        label: 'Corrected Velocity v (accepted, m/s)',
        data: acceptedResults.map((r) => ({ x: r.radiusSqMm2, y: r.correctedVelocityMs })),
        backgroundColor: '#22d3ee',
        pointRadius: 6,
      },
      {
        type: 'scatter',
        label: "Observed Velocity v' (accepted, m/s)",
        data: acceptedResults.map((r) => ({ x: r.radiusSqMm2, y: r.observedVelocityMs })),
        backgroundColor: '#f59e0b',
        pointRadius: 6,
      },
    ];

    if (
      !summary.hasMixedMediumConditions &&
      acceptedResults.length > 0 &&
      summary.graphSlopeDisplayMm2PerS !== null &&
      summary.observedGraphSlopePerMS !== null
    ) {
      datasets.push(
        {
          type: 'line',
          label: 'Corrected Fit',
          data: [{ x: 0, y: 0 }, { x: maxR2, y: corSlopeMm2 * maxR2 }],
          borderColor: '#22d3ee',
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          type: 'line',
          label: 'Observed Fit',
          data: [{ x: 0, y: 0 }, { x: maxR2, y: obsSlopeMm2 * maxR2 }],
          borderColor: '#f59e0b',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
        },
      );
    }

    return {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { size: 11 } } },
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            title: { display: true, text: 'Radius Squared r² (mm²)', color: '#cbd5e1' },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR },
          },
          y: {
            type: 'linear',
            min: 0,
            title: { display: true, text: 'Velocity (m/s)', color: '#cbd5e1' },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR },
          },
        },
      },
    };
  }, [
    acceptedResults,
    summary.hasMixedMediumConditions,
    summary.observedGraphSlopePerMS,
    summary.graphSlopeDisplayMm2PerS,
  ]);

  // Graph 3: Individual Viscosity vs Radius (distinguishes valid, caution, and excluded Re >= 1.0)
  const viscosityVsRadiusConfig = useMemo<ChartConfiguration>(() => {
    const validPts = validResults
      .filter((r) => r.viscosityPas !== null)
      .map((r) => ({ x: r.radiusMm, y: r.viscosityPas! }));
    const cautionPts = cautionResults
      .filter((r) => r.viscosityPas !== null)
      .map((r) => ({ x: r.radiusMm, y: r.viscosityPas! }));
    const excludedPts = excludedValidGeom
      .filter((r) => r.viscosityPas !== null)
      .map((r) => ({ x: r.radiusMm, y: r.viscosityPas! }));

    const allPts = [...validPts, ...cautionPts, ...excludedPts];
    const minX = allPts.length ? Math.min(...allPts.map((p) => p.x)) * 0.85 : 0.5;
    const maxX = allPts.length ? Math.max(...allPts.map((p) => p.x)) * 1.15 : 3.5;

    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        type: 'scatter',
        label: 'Valid ηᵢ (Re < 0.5)',
        data: validPts,
        backgroundColor: '#38bdf8',
        pointRadius: 6,
      },
    ];

    if (cautionPts.length > 0) {
      datasets.push({
        type: 'scatter',
        label: 'Caution ηᵢ (0.5 ≤ Re < 1)',
        data: cautionPts,
        backgroundColor: '#f59e0b',
        pointStyle: 'rectRot',
        pointRadius: 6.5,
      });
    }

    if (excludedPts.length > 0) {
      datasets.push({
        type: 'scatter',
        label: 'Excluded ηᵢ (Re ≥ 1.0)',
        data: excludedPts,
        backgroundColor: '#f43f5e',
        borderColor: '#fb7185',
        borderWidth: 2,
        pointStyle: 'crossRot',
        pointRadius: 7,
      });
    }

    if (!summary.hasMixedFluidConditions && summary.averageViscosityPas !== null) {
      datasets.push({
        type: 'line',
        label: `Mean η̄ = ${summary.averageViscosityPas.toFixed(4)} Pa·s`,
        data: [
          { x: minX, y: summary.averageViscosityPas },
          { x: maxX, y: summary.averageViscosityPas },
        ],
        borderColor: '#10b981',
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 0,
      });
    }

    if (!summary.hasMixedMediumConditions && summary.graphDerivedViscosityPas !== null) {
      datasets.push({
        type: 'line',
        label: `Graph η = ${summary.graphDerivedViscosityPas.toFixed(4)} Pa·s`,
        data: [
          { x: minX, y: summary.graphDerivedViscosityPas },
          { x: maxX, y: summary.graphDerivedViscosityPas },
        ],
        borderColor: '#a855f7',
        borderWidth: 2,
        pointRadius: 0,
      });
    }

    return {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Ball Radius r (mm)', color: '#cbd5e1' },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR },
          },
          y: {
            type: 'linear',
            min: 0,
            title: { display: true, text: 'Viscosity η (Pa·s)', color: '#cbd5e1' },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR },
          },
        },
      },
    };
  }, [
    validResults,
    cautionResults,
    excludedValidGeom,
    summary.hasMixedFluidConditions,
    summary.hasMixedMediumConditions,
    summary.averageViscosityPas,
    summary.graphDerivedViscosityPas,
  ]);

  // Graph 4: Measured vs Theoretical Terminal Velocity
  const measuredVsTheoryConfig = useMemo<ChartConfiguration>(() => {
    const plotRows = summary.results.filter(
      (r) => r.validationErrors.length === 0 && r.netSettlingPossible,
    );
    return {
      type: 'bar',
      data: {
        labels: plotRows.map(
          (r) =>
            `${r.label} (${r.radiusMm} mm)${
              r.reynoldsStatus === 'invalid'
                ? ' [Re≥1]'
                : r.reynoldsStatus === 'caution'
                  ? ' [Caution]'
                  : ''
            }`,
        ),
        datasets: [
          {
            label: 'Corrected Measured v (m/s)',
            data: plotRows.map((r) => r.correctedVelocityMs),
            backgroundColor: plotRows.map((r) =>
              r.reynoldsStatus === 'invalid'
                ? 'rgba(244, 63, 94, 0.72)'
                : r.reynoldsStatus === 'caution'
                  ? 'rgba(245, 158, 11, 0.75)'
                  : 'rgba(34, 211, 238, 0.78)',
            ),
            borderColor: plotRows.map((r) =>
              r.reynoldsStatus === 'invalid'
                ? '#f43f5e'
                : r.reynoldsStatus === 'caution'
                  ? '#f59e0b'
                  : '#22d3ee',
            ),
            borderWidth: 1,
          },
          {
            label: 'Theoretical Stokes v_th (m/s)',
            data: plotRows.map((r) => r.theoreticalVelocityMs ?? 0),
            backgroundColor: 'rgba(59, 130, 246, 0.58)',
            borderColor: '#60a5fa',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
        scales: {
          x: {
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Terminal Velocity (m/s)', color: '#cbd5e1' },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR },
          },
        },
      },
    };
  }, [summary.results]);

  // Graph 5: Kinematics & Force Buildup during Fall for Selected Ball (synced with 3D driver)
  const kinematicsConfig = useMemo<ChartConfiguration>(() => {
    const validRefEta =
      activeViscosityPas && activeViscosityPas > 0
        ? activeViscosityPas
        : env.referenceViscosityPas > 0
          ? env.referenceViscosityPas
          : 0.95;

    const eta =
      velocitySource === 'measured_run' && selectedBall.viscosityPas
        ? selectedBall.viscosityPas
        : validRefEta;

    const totalTravelM = Math.max(0.05, env.columnHeightMm * 0.84 * 1e-3);

    let vTerm = 0;
    if (selectedBall.validationErrors.length === 0 && selectedBall.netSettlingPossible) {
      if (velocitySource === 'measured_run') {
        vTerm = selectedBall.observedVelocityMs;
      } else {
        const predT = computePredictedTimeS(
          selectedBall.radiusMm,
          selectedBall.lengthMm,
          env,
          eta,
        );
        if (predT && predT > 0) {
          vTerm = selectedBall.lengthM / predT;
        }
      }
    }

    const tauPhysS =
      selectedBall.radiusM > 0 && eta > 0
        ? (2 * env.ballDensityKgM3 * selectedBall.radiusM * selectedBall.radiusM) / (9 * eta)
        : 0.05;
    const tauEff = pedagogicalRamp ? Math.max(tauPhysS, 0.35) : Math.max(tauPhysS, 1e-4);
    const transitTimeS = vTerm > 0 ? totalTravelM / vTerm : 2.0;
    const maxTimeS =
      vTerm > 0
        ? !pedagogicalRamp && tauEff < 0.1
          ? Math.max(tauEff * 4.5, Math.min(0.25, transitTimeS))
          : Math.min(8, Math.max(tauEff * 4.5, Math.min(4.0, transitTimeS)))
        : 2.0;

    const steps = 40;
    const labels: string[] = [];
    const velocitySeries: number[] = [];
    const dragSeries: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * maxTimeS;
      const st = evaluateFallKinematics({
        timeS: t,
        radiusM: selectedBall.radiusM,
        ballDensityKgM3: env.ballDensityKgM3,
        liquidDensityKgM3: env.liquidDensityKgM3,
        gravityMs2: env.gravityMs2,
        terminalObservedVelocityMs: vTerm,
        effectiveViscosityPas: eta,
        totalTravelM: totalTravelM * 1.5, // keep curve clean before floor stop
        pedagogicalRamp,
      });
      labels.push(maxTimeS < 0.5 ? t.toFixed(4) : t.toFixed(2));
      velocitySeries.push(st.velocityMs * 100); // cm/s
      dragSeries.push(st.dragForceN * 1000); // mN
    }

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Velocity v(t) (cm/s)',
            data: velocitySeries,
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34, 211, 238, 0.14)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            yAxisID: 'y',
          },
          {
            label: 'Viscous Drag Fd(t) (mN)',
            data: dragSeries,
            borderColor: '#f59e0b',
            borderDash: [4, 3],
            tension: 0.3,
            pointRadius: 0,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
        scales: {
          x: {
            title: { display: true, text: 'Time t (s)', color: '#cbd5e1' },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: CHART_TICK_COLOR, maxTicksLimit: 8 },
          },
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: 'Velocity (cm/s)', color: '#22d3ee' },
            grid: { color: CHART_GRID_COLOR },
            ticks: { color: '#22d3ee' },
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            title: { display: true, text: 'Drag Force Fd (mN)', color: '#f59e0b' },
            grid: { drawOnChartArea: false },
            ticks: { color: '#f59e0b' },
          },
        },
      },
    };
  }, [selectedBall, env, velocitySource, activeViscosityPas, pedagogicalRamp]);

  if (compactSingleChart) {
    return (
      <PrimaryVR2Chart
        summary={summary}
        showObservedOverlay={false}
        heightClass="h-56"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Regression Summary Header + Primary Graph */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 lab-subpanel rounded-xl p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-100">
                1. Corrected Terminal Velocity (v) vs Radius Squared (r²)
              </h3>
              <p className="text-xs text-slate-400">
                Origin-constrained linear fit across sequentially saved single-ball readings (Re &lt; 1.0) verifying v ∝ r²
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={showObservedOverlay}
                onChange={(e) => setShowObservedOverlay(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-400"
              />
              <span>Show Uncorrected v&apos;</span>
            </label>
          </div>
          <PrimaryVR2Chart summary={summary} showObservedOverlay={showObservedOverlay} heightClass="h-80" />
        </div>

        {/* Graph-Derived Viscosity Analytical Card */}
        <div className="lg:col-span-4 lab-subpanel rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <h4 className="font-display text-base font-semibold text-cyan-300">
              Graph-Based Viscosity Analysis
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              Regression computed in SI units (r² in m², v in m/s) from saved readings, excluding Re ≥ 1.0 inertial runs.
            </p>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <MathFormula
                displayMode
                tex="\text{Slope } m = \frac{2(\rho_b - \rho_l)g}{9\eta} \implies \eta_{\text{graph}} = \frac{2(\rho_b - \rho_l)g}{9\,m}"
              />
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <dt className="text-slate-400">SI Slope (m)</dt>
                <dd className="font-mono font-semibold text-slate-100">
                  {summary.graphSlopePerMS !== null
                    ? `${summary.graphSlopePerMS.toFixed(1)} m⁻¹s⁻¹`
                    : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <dt className="text-slate-400">Display Slope</dt>
                <dd className="font-mono text-xs text-slate-300">
                  {summary.graphSlopeDisplayMm2PerS !== null
                    ? `${summary.graphSlopeDisplayMm2PerS.toFixed(5)} m/(s·mm²)`
                    : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <dt className="text-slate-400">Regression Equation</dt>
                <dd className="font-mono text-xs text-cyan-300">
                  {summary.graphSlopePerMS !== null
                    ? `v = ${summary.graphSlopePerMS.toFixed(1)} r²`
                    : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <dt className="text-slate-400">Goodness of Fit (R²)</dt>
                <dd className="font-mono font-semibold text-emerald-400" data-testid="graph-rsquared-value">
                  {summary.graphRSquared !== null
                    ? summary.graphRSquared.toFixed(5)
                    : summary.rSquaredStatus === 'mixed_conditions'
                      ? 'N/A (mixed)'
                      : summary.rSquaredStatus === 'same_radius'
                        ? 'N/A (1 radius)'
                        : summary.acceptedResults.length === 1
                          ? 'N/A (< 2 pts)'
                          : '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/25 p-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block">Graph Viscosity</span>
                <span className="font-mono text-lg font-bold text-cyan-300" data-testid="graph-viscosity-value">
                  {summary.graphDerivedViscosityPas !== null
                    ? summary.graphDerivedViscosityPas.toFixed(4)
                    : '—'}
                </span>
                <span className="ml-1 font-mono text-[11px] text-slate-400">Pa·s</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">
                  {summary.hasMixedFluidConditions
                    ? 'Mean η̄ (mixed fluids)'
                    : `Mean η̄ (${summary.validViscosityCount} accepted)`}
                </span>
                <span className="font-mono text-lg font-bold text-slate-100">
                  {summary.averageViscosityPas !== null
                    ? summary.averageViscosityPas.toFixed(4)
                    : '—'}
                </span>
                <span className="ml-1 font-mono text-[11px] text-slate-400">Pa·s</span>
              </div>
            </div>
            <div className="mt-2 border-t border-cyan-500/20 pt-2 text-xs text-slate-300">
              Mean vs Graph discrepancy:{' '}
              <span className="font-mono font-semibold text-cyan-200">
                {summary.viscosityDiscrepancyPct !== null
                  ? `${summary.viscosityDiscrepancyPct.toFixed(2)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary 4 Scientific Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lab-subpanel rounded-xl p-5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            2. Ladenburg Correction Effect: Observed v&apos; vs Corrected v
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            Wall &amp; end effects retard observed velocity v&apos;; correction restores true Stokes velocity v (accepted runs).
          </p>
          <ChartCanvas config={observedVsCorrectedConfig} heightClass="h-64" />
        </div>

        <div className="lab-subpanel rounded-xl p-5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            3. Individual Experimental Viscosity (ηᵢ) vs Ball Radius (r)
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            For a Newtonian fluid in the Stokes regime, ηᵢ stays constant; Re ≥ 1.0 points are marked in rose and excluded from mean η̄.
          </p>
          <ChartCanvas config={viscosityVsRadiusConfig} heightClass="h-64" />
        </div>

        <div className="lab-subpanel rounded-xl p-5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            4. Measured Corrected Velocity vs Theoretical Stokes Velocity
          </h3>
          <p className="mb-3 text-xs text-slate-400" data-testid="graph4-subtitle">
            {summary.hasMixedFluidConditions
              ? 'Mixed fluids detected: each bar compares against its own saved fluid reference η.'
              : env.useAutoExperimentalViscosity && summary.averageViscosityPas !== null
                ? `Using experimental mean viscosity η̄ = ${summary.averageViscosityPas.toFixed(4)} Pa·s.`
                : `Using reference η = ${env.referenceViscosityPas} Pa·s.`}
          </p>
          <ChartCanvas config={measuredVsTheoryConfig} heightClass="h-64" />
        </div>

        <div className="lab-subpanel rounded-xl p-5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            5. Falling Kinematics &amp; Drag Buildup ({selectedBall.label})
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            {selectedBall.netSettlingPossible
              ? `Mode: ${velocitySource === 'live_physics' ? 'Live Stokes Physics' : 'Measured Stopwatch (L/T)'}${pedagogicalRamp ? ' · Extended acceleration ramp active' : ''}.`
              : `No downward settling (${selectedBall.buoyancyCondition === 'neutral' ? 'neutral buoyancy' : 'floating'}): v(t) = 0, Fd = 0.`}
          </p>
          <ChartCanvas config={kinematicsConfig} heightClass="h-64" />
        </div>
      </div>
    </div>
  );
}
