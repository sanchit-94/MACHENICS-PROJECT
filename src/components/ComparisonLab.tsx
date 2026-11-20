import { useEffect, useMemo, useState } from 'react';
import {
  BALL_MATERIAL_PRESETS,
  LIQUID_PRESETS,
  RADIUS_PRESETS_MM,
  computeTheoreticalVelocityMs,
  type BallCalculationResult,
  type ExperimentSummary,
  type LabEnvironment,
} from '../physics/stokes';
import { MathFormula } from './MathFormula';

interface ComparisonLabProps {
  summary: ExperimentSummary;
  activeBallResult: BallCalculationResult;
  env: LabEnvironment;
  activeViscosityPas: number;
}

export function ComparisonLab({
  summary,
  activeBallResult,
  env,
  activeViscosityPas,
}: ComparisonLabProps) {
  const [sweepRadiusMm, setSweepRadiusMm] = useState<number>(2.0);
  const [customCompareRhoL, setCustomCompareRhoL] = useState<number>(env.liquidDensityKgM3);
  const [customCompareRhoB, setCustomCompareRhoB] = useState<number>(env.ballDensityKgM3);

  useEffect(() => {
    setCustomCompareRhoL(env.liquidDensityKgM3);
  }, [env.liquidDensityKgM3]);

  useEffect(() => {
    setCustomCompareRhoB(env.ballDensityKgM3);
  }, [env.ballDensityKgM3]);

  const etaForScaling = activeViscosityPas > 0 ? activeViscosityPas : 0.95;

  const baseR1 = RADIUS_PRESETS_MM[0];
  const vAtR1 = computeTheoreticalVelocityMs(baseR1, env, etaForScaling);

  const customComparisonVel = useMemo(() => {
    const tempEnv: LabEnvironment = {
      ...env,
      liquidDensityKgM3: customCompareRhoL,
      ballDensityKgM3: customCompareRhoB,
    };
    return computeTheoreticalVelocityMs(sweepRadiusMm, tempEnv, etaForScaling);
  }, [env, customCompareRhoL, customCompareRhoB, sweepRadiusMm, etaForScaling]);

  return (
    <div className="space-y-6">
      {/* 1. Active Single-Ball Trial vs Sequential Dataset Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lab-subpanel rounded-xl p-5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Active Single-Ball Trial vs. Saved Sequential Dataset
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Compare the current single-sphere run (r = {activeBallResult.radiusMm.toFixed(1)} mm) against the accumulated sequential readings dataset.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Metric</th>
                  <th className="py-2 px-3 font-medium text-cyan-300">Active Single Sphere</th>
                  <th className="py-2 pl-3 font-medium text-blue-300">
                    Saved Dataset ({summary.results.length} {summary.results.length === 1 ? 'Trial' : 'Trials'})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono">
                <tr>
                  <td className="py-2.5 pr-3 font-sans text-slate-300">Stokes Validity</td>
                  <td className="py-2.5 px-3 text-slate-200">
                    {activeBallResult.isStokesAccepted
                      ? activeBallResult.reynoldsStatus === 'caution'
                        ? 'Caution (0.5 ≤ Re < 1)'
                        : 'Valid (Re < 0.5)'
                      : activeBallResult.buoyancyCondition !== 'sinking'
                        ? activeBallResult.buoyancyCondition
                        : 'Excluded (Re ≥ 1)'}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-200">
                    {summary.acceptedResults.length} / {summary.results.length} accepted
                    {summary.excludedResults.length > 0 && (
                      <span className="ml-1 text-[10px] text-rose-400">
                        ({summary.excludedResults.length} excl.)
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-sans text-slate-300">Viscosity η / Mean η̄</td>
                  <td className="py-2.5 px-3 text-slate-100">
                    {activeBallResult.viscosityPas !== null
                      ? `${activeBallResult.viscosityPas.toFixed(4)} Pa·s`
                      : '—'}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-100">
                    {summary.averageViscosityPas !== null
                      ? `${summary.averageViscosityPas.toFixed(4)} Pa·s`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-sans text-slate-300">Graph Viscosity η_graph</td>
                  <td className="py-2.5 px-3 text-slate-400">Single trial</td>
                  <td className="py-2.5 pl-3 text-blue-300">
                    {summary.graphDerivedViscosityPas !== null
                      ? `${summary.graphDerivedViscosityPas.toFixed(4)} Pa·s`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-sans text-slate-300">Corrected v / Fit Slope</td>
                  <td className="py-2.5 px-3 text-cyan-300">
                    {activeBallResult.netSettlingPossible
                      ? `${activeBallResult.correctedVelocityMs.toFixed(5)} m/s`
                      : '—'}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-200">
                    {summary.graphSlopePerMS !== null
                      ? `${summary.graphSlopePerMS.toFixed(1)} m⁻¹s⁻¹`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-sans text-slate-300">Reynolds Re / Fit R²</td>
                  <td className="py-2.5 px-3 text-slate-200">
                    {activeBallResult.reynoldsNumber !== null
                      ? `Re = ${activeBallResult.reynoldsNumber.toFixed(3)}`
                      : '—'}
                  </td>
                  <td className="py-2.5 pl-3 text-emerald-400">
                    {summary.graphRSquared !== null
                      ? `R² = ${summary.graphRSquared.toFixed(5)}`
                      : summary.rSquaredStatus === 'mixed_conditions'
                        ? 'N/A (mixed)'
                        : summary.rSquaredStatus === 'same_radius'
                          ? 'Need ≥ 2 radii'
                          : 'Need ≥ 2 trials'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-sans text-slate-300">Mean vs Graph Δ%</td>
                  <td className="py-2.5 px-3 text-slate-400">—</td>
                  <td className="py-2.5 pl-3 text-slate-200">
                    {summary.viscosityDiscrepancyPct !== null
                      ? `${summary.viscosityDiscrepancyPct.toFixed(2)}%`
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Quadratic Scaling Proof: v proportional to r^2 */}
        <div className="lab-subpanel rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-100">
                Verification of Quadratic Law: <MathFormula tex="v \propto r^2" />
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Doubling radius (1 mm → 2 mm) increases Stokes terminal velocity by exactly 4×; tripling (→ 3 mm) increases it by 9×.
              </p>
            </div>
            <span className="font-mono text-xs text-cyan-300">
              η = {etaForScaling.toFixed(3)} Pa·s
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-2 font-medium">Radius r</th>
                  <th className="py-2 px-2 font-medium">r² (mm²)</th>
                  <th className="py-2 px-2 font-medium">Ratio (r/r₁)²</th>
                  <th className="py-2 px-2 font-medium">Terminal v_th</th>
                  <th className="py-2 pl-2 font-medium">Velocity Ratio v/v₁</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono">
                {RADIUS_PRESETS_MM.map((rMm) => {
                  const v = computeTheoreticalVelocityMs(rMm, env, etaForScaling);
                  const expectedFactor = (rMm / baseR1) ** 2;
                  const actualFactor = v !== null && vAtR1 ? v / vAtR1 : null;
                  return (
                    <tr key={rMm}>
                      <td className="py-2 pr-2 text-slate-100">{rMm.toFixed(1)} mm</td>
                      <td className="py-2 px-2 text-slate-300">{(rMm * rMm).toFixed(2)}</td>
                      <td className="py-2 px-2 text-blue-300">{expectedFactor.toFixed(2)}×</td>
                      <td className="py-2 px-2 text-cyan-300">
                        {v !== null ? `${(v * 100).toFixed(3)} cm/s` : 'N/A (ρb ≤ ρl)'}
                      </td>
                      <td className="py-2 pl-2 text-emerald-400">
                        {actualFactor !== null ? `${actualFactor.toFixed(2)}×` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Interactive Density Explorer & Cross-Fluid / Cross-Material Matrix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 lab-subpanel rounded-xl p-5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Interactive Density Sensitivity Sandbox
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Explore how liquid density ρl and ball density ρb govern net buoyancy (ρb − ρl) and terminal speed.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="cmp-radius" className="text-slate-300">Test Sphere Radius r</label>
                <span className="font-mono text-cyan-300">{sweepRadiusMm.toFixed(1)} mm</span>
              </div>
              <input
                id="cmp-radius"
                type="range"
                min={0.5}
                max={4.0}
                step={0.1}
                value={sweepRadiusMm}
                onChange={(e) => setSweepRadiusMm(Number(e.target.value))}
                className="lab-slider mt-1.5 w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="cmp-rhol" className="text-slate-300">Liquid Density ρl</label>
                <span className="font-mono text-cyan-300">{customCompareRhoL} kg/m³</span>
              </div>
              <input
                id="cmp-rhol"
                type="range"
                min={700}
                max={2000}
                step={10}
                value={customCompareRhoL}
                onChange={(e) => setCustomCompareRhoL(Number(e.target.value))}
                className="lab-slider mt-1.5 w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="cmp-rhob" className="text-slate-300">Ball Density ρb</label>
                <span className="font-mono text-cyan-300">{customCompareRhoB} kg/m³</span>
              </div>
              <input
                id="cmp-rhob"
                type="range"
                min={500}
                max={16000}
                step={50}
                value={customCompareRhoB}
                onChange={(e) => setCustomCompareRhoB(Number(e.target.value))}
                className="lab-slider mt-1.5 w-full"
              />
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Effective Density Contrast (ρb − ρl)</span>
                <span
                  className={`font-mono font-semibold ${
                    customCompareRhoB - customCompareRhoL > 0 ? 'text-cyan-300' : 'text-rose-400'
                  }`}
                >
                  {customCompareRhoB - customCompareRhoL} kg/m³
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs text-slate-300">Predicted Stokes Velocity</span>
                {customComparisonVel !== null ? (
                  <span className="font-mono text-lg font-bold text-cyan-300">
                    {(customComparisonVel * 100).toFixed(3)} cm/s
                  </span>
                ) : (
                  <span className="font-mono text-xs font-semibold text-rose-400">
                    {Math.abs(customCompareRhoB - customCompareRhoL) <= 1e-9
                      ? '● Neutral Buoyancy (Net Force = 0)'
                      : '▲ Floats Upward (ρb < ρl)'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 lab-subpanel rounded-xl p-5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Fluid &amp; Sphere Material Reference Comparison (r = {sweepRadiusMm.toFixed(1)} mm)
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold text-cyan-300">
                Across Viscous Liquids (ρb = {env.ballDensityKgM3} kg/m³)
              </h4>
              <div className="space-y-1.5 text-xs">
                {LIQUID_PRESETS.map((liq) => {
                  const v = computeTheoreticalVelocityMs(
                    sweepRadiusMm,
                    { ...env, liquidDensityKgM3: liq.densityKgM3 },
                    liq.referenceViscosityPas,
                  );
                  const re =
                    v !== null
                      ? (liq.densityKgM3 * (2 * sweepRadiusMm * 1e-3) * v) / liq.referenceViscosityPas
                      : null;
                  return (
                    <div
                      key={liq.id}
                      className="flex items-center justify-between rounded border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5"
                    >
                      <div>
                        <div className="font-medium text-slate-200">{liq.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">
                          ρ={liq.densityKgM3} · η={liq.referenceViscosityPas} Pa·s
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-cyan-300">
                          {v !== null ? `${(v * 100).toFixed(2)} cm/s` : 'Floats'}
                        </div>
                        <div
                          className={`text-[10px] ${
                            re !== null && re < 0.5 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {re !== null ? `Re=${re < 0.01 ? re.toExponential(1) : re.toFixed(2)}` : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold text-blue-300">
                Across Sphere Materials (ρl = {env.liquidDensityKgM3} kg/m³)
              </h4>
              <div className="space-y-1.5 text-xs">
                {BALL_MATERIAL_PRESETS.map((mat) => {
                  const v = computeTheoreticalVelocityMs(
                    sweepRadiusMm,
                    { ...env, ballDensityKgM3: mat.densityKgM3 },
                    etaForScaling,
                  );
                  return (
                    <div
                      key={mat.id}
                      className="flex items-center justify-between rounded border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5"
                    >
                      <div>
                        <div className="font-medium text-slate-200">{mat.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">
                          ρb = {mat.densityKgM3} kg/m³
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        {v !== null ? (
                          <span className="text-cyan-300">{(v * 100).toFixed(2)} cm/s</span>
                        ) : (
                          <span className="text-rose-400">Floats (ρb ≤ ρl)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
