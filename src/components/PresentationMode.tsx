import { useState } from 'react';
import { BookmarkPlus, X } from 'lucide-react';
import {
  LIQUID_PRESETS,
  RADIUS_PRESETS_MM,
  type BallCalculationResult,
  type BallMeasurement,
  type ExperimentSummary,
  type FallKinematicsState,
  type LabEnvironment,
  type LiquidPresetId,
} from '../physics/stokes';
import { StokesLab3D, type SimulationConfig } from './StokesLab3D';
import { PrimaryVR2Chart } from './ScientificGraphs';

interface PresentationModeProps {
  isOpen: boolean;
  onClose: () => void;
  env: LabEnvironment;
  onUpdateEnv: (patch: Partial<LabEnvironment>) => void;
  activeBall: BallMeasurement;
  onUpdateActiveBall: (patch: Partial<BallMeasurement>) => void;
  activeBallResult: BallCalculationResult;
  summary: ExperimentSummary;
  onSaveReading: () => void;
  simConfig: SimulationConfig;
}

export function PresentationMode({
  isOpen,
  onClose,
  env,
  onUpdateEnv,
  activeBall,
  onUpdateActiveBall,
  activeBallResult,
  summary,
  onSaveReading,
  simConfig,
}: PresentationModeProps) {
  const [liveKinematics, setLiveKinematics] = useState<FallKinematicsState | null>(null);

  if (!isOpen) return null;

  const fg = liveKinematics?.weightForceN ?? activeBallResult.weightForceN;
  const fb = liveKinematics?.buoyancyForceN ?? activeBallResult.buoyancyForceN;
  const fd = liveKinematics?.dragForceN ?? activeBallResult.terminalDragForceN;
  const maxForce = Math.max(1e-9, fg, fb + fd);

  return (
    <div
      data-testid="presentation-mode-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-[#050914] text-slate-100 overflow-y-auto lg:overflow-hidden"
    >
      {/* Top Classroom Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-[#080e1f] px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-display text-base font-bold text-cyan-300 whitespace-nowrap">
            Professor Presentation Mode
          </span>
          <span className="hidden md:inline text-xs text-slate-400 truncate">
            IIITDM Jabalpur · Experiment 08 · Single-Ball Stokes&apos; Law Apparatus
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onSaveReading}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-cyan-400 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition-colors whitespace-nowrap"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>Save Reading ({summary.results.length})</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap"
          >
            <X className="h-4 w-4" />
            <span>Exit Presentation</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Single-Screen Classroom Cockpit */}
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:overflow-hidden">
        {/* Left: Live 3D Single-Ball Apparatus */}
        <div className="lg:col-span-5 flex flex-col min-h-[420px]">
          <StokesLab3D
            config={simConfig}
            onKinematicsSample={setLiveKinematics}
            className="flex-1 !h-full min-h-[440px]"
          />
        </div>

        {/* Center: Live Classroom Controls & Force Balance */}
        <div className="lg:col-span-3 flex flex-col gap-3 overflow-y-auto pr-0.5">
          <div className="lab-subpanel rounded-xl p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold text-cyan-300">
              Single-Ball Demonstration Controls
            </h3>

            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="pres-radius" className="text-slate-300">Ball Radius r</label>
                <span className="font-mono text-cyan-300">{activeBall.radiusMm.toFixed(2)} mm</span>
              </div>
              <input
                id="pres-radius"
                type="range"
                min={0.5}
                max={4.0}
                step={0.1}
                value={activeBall.radiusMm}
                onChange={(e) => onUpdateActiveBall({ radiusMm: Number(e.target.value) })}
                className="lab-slider mt-1 w-full"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {RADIUS_PRESETS_MM.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onUpdateActiveBall({ radiusMm: r })}
                    className={`rounded px-2 py-0.5 font-mono text-[11px] ${
                      Math.abs(activeBall.radiusMm - r) < 0.01
                        ? 'bg-cyan-400 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {r}mm
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="pres-rhol" className="text-slate-300">Liquid Density ρl</label>
                <span className="font-mono text-cyan-300">{env.liquidDensityKgM3} kg/m³</span>
              </div>
              <input
                id="pres-rhol"
                type="range"
                min={700}
                max={1600}
                step={10}
                value={env.liquidDensityKgM3}
                onChange={(e) =>
                  onUpdateEnv({ liquidPreset: 'custom', liquidDensityKgM3: Number(e.target.value) })
                }
                className="lab-slider mt-1 w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="pres-rhob" className="text-slate-300">Ball Density ρb</label>
                <span className="font-mono text-cyan-300">{env.ballDensityKgM3} kg/m³</span>
              </div>
              <input
                id="pres-rhob"
                type="range"
                min={600}
                max={15600}
                step={100}
                value={env.ballDensityKgM3}
                onChange={(e) =>
                  onUpdateEnv({ ballMaterial: 'custom', ballDensityKgM3: Number(e.target.value) })
                }
                className="lab-slider mt-1 w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="pres-liquid" className="text-[11px] text-slate-400 block">
                  Liquid Medium
                </label>
                <select
                  id="pres-liquid"
                  value={env.liquidPreset}
                  onChange={(e) => {
                    const id = e.target.value as LiquidPresetId;
                    const found = LIQUID_PRESETS.find((l) => l.id === id);
                    if (!found) {
                      onUpdateEnv({ liquidPreset: 'custom' });
                    } else {
                      onUpdateEnv({
                        liquidPreset: found.id,
                        liquidDensityKgM3: found.densityKgM3,
                        referenceViscosityPas: found.referenceViscosityPas,
                        useAutoExperimentalViscosity: false,
                      });
                    }
                  }}
                  className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
                >
                  {LIQUID_PRESETS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label htmlFor="pres-eta" className="text-[11px] text-slate-400 block">
                  {env.useAutoExperimentalViscosity && summary.averageViscosityPas !== null
                    ? 'Synced η̄ (Pa·s)'
                    : 'Ref η (Pa·s)'}
                </label>
                <input
                  id="pres-eta"
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
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isFinite(val)) {
                      onUpdateEnv({
                        referenceViscosityPas: Math.max(0.0001, val),
                        useAutoExperimentalViscosity: false,
                      });
                    }
                  }}
                  className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-slate-100 disabled:opacity-55"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={env.useAutoExperimentalViscosity}
                onChange={(e) => onUpdateEnv({ useAutoExperimentalViscosity: e.target.checked })}
                className="h-3.5 w-3.5 accent-cyan-400"
              />
              <span>Auto-use mean η̄ for theory</span>
            </label>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label htmlFor="pres-L" className="text-[11px] text-slate-400 block">
                  Distance L (mm)
                </label>
                <input
                  id="pres-L"
                  type="number"
                  min={10}
                  max={1000}
                  step={5}
                  value={activeBall.lengthMm}
                  onChange={(e) =>
                    onUpdateActiveBall({ lengthMm: Math.max(1, Number(e.target.value)) })
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="pres-T" className="text-[11px] text-slate-400 block">
                  Time T (s)
                </label>
                <input
                  id="pres-T"
                  type="number"
                  min={0.0001}
                  max={300}
                  step="any"
                  value={activeBall.timeS}
                  onChange={(e) =>
                    onUpdateActiveBall({ timeS: Math.max(0.0001, Number(e.target.value)) })
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Force Balance Bars */}
          <div className="lab-subpanel rounded-xl p-4 space-y-2.5">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Real-Time Force Balance
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div>
                <div className="flex justify-between text-rose-300">
                  <span>Weight Fg (↓)</span>
                  <span>{(fg * 1000).toFixed(3)} mN</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-100"
                    style={{ width: `${(fg / maxForce) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sky-300">
                  <span>Buoyancy Fb (↑)</span>
                  <span>{(fb * 1000).toFixed(3)} mN</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 transition-all duration-100"
                    style={{ width: `${(fb / maxForce) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-amber-300">
                  <span>Viscous Drag Fd (↑)</span>
                  <span>{(fd * 1000).toFixed(3)} mN</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-100"
                    style={{ width: `${(fd / maxForce) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Active Single-Ball Readout + Sequential Dataset Graph */}
        <div className="lg:col-span-4 flex flex-col gap-3 overflow-y-auto pr-0.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="lab-subpanel rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Active Sphere Corrected v</span>
              <span className="font-mono text-xl font-bold text-cyan-300">
                {activeBallResult.netSettlingPossible ? activeBallResult.correctedVelocityMs.toFixed(4) : '—'}
              </span>
              <span className="ml-1 font-mono text-xs text-slate-400">m/s</span>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                v&apos;={activeBallResult.observedVelocityMs.toFixed(4)} · v_th={activeBallResult.theoreticalVelocityMs?.toFixed(4) ?? '—'}
              </div>
            </div>
            <div className="lab-subpanel rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">
                Active η / Dataset Mean η̄
              </span>
              <span className="font-mono text-xl font-bold text-slate-100">
                {activeBallResult.viscosityPas !== null ? activeBallResult.viscosityPas.toFixed(4) : '—'}
              </span>
              <span className="ml-1 font-mono text-xs text-slate-400">Pa·s</span>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                Mean η̄ = {summary.averageViscosityPas?.toFixed(4) ?? '—'} ({summary.acceptedResults.length} valid)
              </div>
            </div>
            <div className="lab-subpanel rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Graph Viscosity η</span>
              <span className="font-mono text-xl font-bold text-blue-300">
                {summary.graphDerivedViscosityPas !== null
                  ? summary.graphDerivedViscosityPas.toFixed(4)
                  : '—'}
              </span>
              <span className="ml-1 font-mono text-xs text-slate-400">Pa·s</span>
            </div>
            <div className="lab-subpanel rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Slope &amp; R²</span>
              <span className="font-mono text-sm font-bold text-emerald-400 block">
                {summary.graphSlopePerMS !== null
                  ? `m = ${summary.graphSlopePerMS.toFixed(0)} m⁻¹s⁻¹`
                  : '—'}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                R² ={' '}
                {summary.graphRSquared !== null
                  ? summary.graphRSquared.toFixed(4)
                  : summary.rSquaredStatus === 'mixed_conditions'
                    ? 'N/A (mixed)'
                    : summary.rSquaredStatus === 'same_radius'
                      ? 'N/A (1 radius)'
                      : 'N/A'}
              </span>
            </div>
          </div>

          <div className="lab-subpanel rounded-xl p-4">
            <h3 className="font-display text-sm font-semibold text-slate-100 mb-2">
              Stokes&apos; Law Plot: v vs r² ({summary.results.length} Saved Readings)
            </h3>
            <PrimaryVR2Chart summary={summary} showObservedOverlay={false} heightClass="h-48" />
          </div>

          <div className="lab-subpanel rounded-xl p-3.5 text-xs">
            <div className="font-display font-semibold text-slate-200 mb-1.5">
              Active Sphere Summary (r = {activeBallResult.radiusMm.toFixed(1)} mm)
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <div className="text-slate-400">Ladenburg C_L</div>
                <div className="text-cyan-300 mt-0.5">
                  {activeBallResult.combinedCorrectionCL.toFixed(4)}
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <div className="text-slate-400">Reynolds Re</div>
                <div className="text-blue-300 mt-0.5">
                  {activeBallResult.reynoldsNumber !== null ? activeBallResult.reynoldsNumber.toFixed(4) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
