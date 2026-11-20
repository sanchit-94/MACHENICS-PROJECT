import { Download, Printer, FileText } from 'lucide-react';
import {
  LIQUID_PRESETS,
  type BallCalculationResult,
  type ExperimentSummary,
  type LabEnvironment,
} from '../physics/stokes';
import { MathFormula } from './MathFormula';
import { PrimaryVR2Chart } from './ScientificGraphs';

interface LabReportProps {
  summary: ExperimentSummary;
  activeBallResult: BallCalculationResult;
  env: LabEnvironment;
}

export function LabReport({ summary, activeBallResult, env }: LabReportProps) {
  const liquidName =
    LIQUID_PRESETS.find((l) => l.id === env.liquidPreset)?.name ?? 'Custom Fluid';

  const handleDownloadCsv = () => {
    const headerLines = [
      'Institution,IIITDM Jabalpur - Indian Institute of Information Technology Design and Manufacturing Jabalpur',
      'Experiment,Experiment No. 08 - Verification of Stokes Law and Coefficient of Viscosity (Single-Ball Sequential Protocol)',
      `Fluid Medium,${liquidName}`,
      `Liquid Density (kg/m^3),${env.liquidDensityKgM3}`,
      `Ball Density (kg/m^3),${env.ballDensityKgM3}`,
      `Cylinder Inner Diameter D (mm),${env.cylinderDiameterMm}`,
      `Cylinder Inner Radius R (mm),${(env.cylinderDiameterMm / 2).toFixed(2)}`,
      `Column Height H (mm),${env.columnHeightMm}`,
      `Gravity g (m/s^2),${env.gravityMs2}`,
      '',
      'Reading,Radius r (mm),r^2 (mm^2),Distance L (mm),Time T (s),Observed v\' (m/s),Wall Factor f1,Bottom Factor f2,Combined CL,Corrected v (m/s),Viscosity eta (Pa.s),Reynolds Re,Regime,Stokes Status',
    ];

    const rows = summary.results.map((r) =>
      [
        r.label,
        r.radiusMm.toFixed(3),
        r.radiusSqMm2.toFixed(4),
        r.lengthMm.toFixed(2),
        r.timeS < 0.1 ? r.timeS.toFixed(5) : r.timeS.toFixed(3),
        r.observedVelocityMs.toFixed(6),
        r.wallCorrectionF1.toFixed(5),
        r.bottomCorrectionF2.toFixed(5),
        r.combinedCorrectionCL.toFixed(5),
        r.correctedVelocityMs.toFixed(6),
        r.viscosityPas !== null ? r.viscosityPas.toFixed(6) : 'N/A',
        r.reynoldsNumber !== null ? r.reynoldsNumber.toFixed(4) : 'N/A',
        r.reynoldsStatus,
        r.isStokesAccepted ? 'Accepted' : 'Excluded',
      ].join(','),
    );

    const footerLines = [
      '',
      `Accepted Stokes Readings,${summary.acceptedResults.length} of ${summary.results.length}`,
      `Excluded Readings,${summary.excludedResults.length}`,
      `Arithmetic Mean Viscosity (Pa.s),${summary.averageViscosityPas !== null ? summary.averageViscosityPas.toFixed(6) : 'N/A'}`,
      `Graph Slope v vs r^2 (m^-1 s^-1),${summary.graphSlopePerMS !== null ? summary.graphSlopePerMS.toFixed(3) : 'N/A'}`,
      `Graph R^2,${summary.graphRSquared !== null ? summary.graphRSquared.toFixed(6) : 'N/A'}`,
      `Graph-Derived Viscosity (Pa.s),${summary.graphDerivedViscosityPas !== null ? summary.graphDerivedViscosityPas.toFixed(6) : 'N/A'}`,
      `Discrepancy (%),${summary.viscosityDiscrepancyPct !== null ? summary.viscosityDiscrepancyPct.toFixed(3) : 'N/A'}`,
    ];

    const csv = [...headerLines, ...rows, ...footerLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'iiitdmj_stokes_law_experiment_08_report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadHtmlReport = () => {
    const tableRowsHtml =
      summary.results.length > 0
        ? summary.results
            .map(
              (r) => `
      <tr>
        <td>${r.label}</td>
        <td>${r.radiusMm.toFixed(2)}</td>
        <td>${r.radiusSqMm2.toFixed(2)}</td>
        <td>${r.lengthMm.toFixed(1)}</td>
        <td>${r.timeS < 0.1 ? r.timeS.toFixed(5) : r.timeS.toFixed(3)}</td>
        <td>${r.observedVelocityMs.toFixed(5)}</td>
        <td>${r.wallCorrectionF1.toFixed(4)}</td>
        <td>${r.bottomCorrectionF2.toFixed(4)}</td>
        <td>${r.correctedVelocityMs.toFixed(5)}</td>
        <td>${r.viscosityPas !== null ? r.viscosityPas.toFixed(4) : 'N/A'}</td>
        <td>${r.reynoldsNumber !== null ? r.reynoldsNumber.toFixed(3) : 'N/A'}</td>
        <td>${r.isStokesAccepted ? (r.reynoldsStatus === 'caution' ? 'Caution' : 'Valid') : 'Excluded'}</td>
      </tr>`,
            )
            .join('')
        : '<tr><td colspan="12" style="text-align:center;">No saved sequential readings recorded.</td></tr>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Experiment 08 - Stokes' Law Lab Report · IIITDM Jabalpur</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; max-width: 960px; margin: 32px auto; padding: 0 20px; line-height: 1.55; }
  h1, h2, h3 { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  th { background: #f1f5f9; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 14px 0; }
</style>
</head>
<body>
  <p style="font-size:12px;color:#475569;margin-bottom:4px;">IIITDM JABALPUR · Engineering Physics Mechanics</p>
  <h1>Experiment No. 08: Verification of Stokes' Law &amp; Coefficient of Viscosity</h1>
  <div class="box">
    <strong>Aim:</strong> To verify Stokes' Law (v &prop; r&sup2;) and determine the coefficient of viscosity (&eta;) of ${liquidName} using sequential single-ball falling sphere trials with Ladenburg wall and bottom corrections.
  </div>
  <h2>Active Apparatus Parameters</h2>
  <p>Liquid Density (&rho;<sub>l</sub>) = ${env.liquidDensityKgM3} kg/m&sup3; | Ball Density (&rho;<sub>b</sub>) = ${env.ballDensityKgM3} kg/m&sup3; | Cylinder Inner Diameter (D) = ${env.cylinderDiameterMm} mm (R = ${(env.cylinderDiameterMm / 2).toFixed(2)} mm) | Column Height (H) = ${env.columnHeightMm} mm | g = ${env.gravityMs2} m/s&sup2;</p>
  <h2>Sequential Observation &amp; Calculation Table</h2>
  <table>
    <thead>
      <tr><th>Reading</th><th>r (mm)</th><th>r&sup2; (mm&sup2;)</th><th>L (mm)</th><th>T (s)</th><th>v' (m/s)</th><th>f<sub>1</sub></th><th>f<sub>2</sub></th><th>v (m/s)</th><th>&eta; (Pa&middot;s)</th><th>Re</th><th>Status</th></tr>
    </thead>
    <tbody>${tableRowsHtml}</tbody>
  </table>
  <div class="box">
    <strong>Results (${summary.acceptedResults.length} of ${summary.results.length} saved readings accepted in Stokes regime):</strong><br/>
    Arithmetic Mean Coefficient of Viscosity (&eta;&#772;) = <strong>${summary.averageViscosityPas !== null ? summary.averageViscosityPas.toFixed(4) : 'N/A'} Pa&middot;s</strong><br/>
    Graph Slope (v vs r&sup2;) = ${summary.graphSlopePerMS !== null ? summary.graphSlopePerMS.toFixed(2) : 'N/A'} m<sup>-1</sup>s<sup>-1</sup> (R&sup2; = ${
      summary.graphRSquared !== null
        ? summary.graphRSquared.toFixed(5)
        : summary.rSquaredStatus === 'mixed_conditions'
          ? 'N/A (mixed conditions)'
          : summary.rSquaredStatus === 'same_radius'
            ? 'N/A (need &ge; 2 distinct radii)'
            : 'N/A (need &ge; 2 accepted readings)'
    })<br/>
    Graph-Derived Coefficient of Viscosity (&eta;<sub>graph</sub>) = <strong>${summary.graphDerivedViscosityPas !== null ? summary.graphDerivedViscosityPas.toFixed(4) : 'N/A'} Pa&middot;s</strong>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'iiitdmj_stokes_law_experiment_08_report.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sampleResult = summary.acceptedResults[0] ?? summary.results[0] ?? activeBallResult;
  const radiiSummaryText =
    summary.results.length > 0
      ? summary.results.map((r) => `${r.radiusMm} mm`).join(', ')
      : `${activeBallResult.radiusMm} mm (active)`;

  return (
    <div className="print-only-report space-y-6">
      {/* Export Actions Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-100">
            Experiment 08 — Formal Practical Record
          </h3>
          <p className="text-xs text-slate-400">
            Auto-generated from sequentially saved single-ball measurements, Ladenburg corrections, and regression data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 text-xs font-medium text-slate-100 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadHtmlReport}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 text-xs font-medium text-slate-100 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Export HTML</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Report Document Body */}
      <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-950/60 p-6">
        <div className="border-b border-slate-800 pb-4">
          <div className="text-xs font-mono text-cyan-400">
            IIITDM Jabalpur · Engineering Physics Mechanics · Experiment No. 08
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-100">
            Experimental Verification of Stokes&apos; Law and Determination of Coefficient of Viscosity
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-300">
              1. Aim
            </h4>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              To determine the coefficient of viscosity (<MathFormula tex="\eta" />) of a viscous liquid
              ({liquidName}) by releasing one spherical ball at a time through the fluid column, recording
              sequential trials across sphere radii, applying Ladenburg wall and end corrections, and verifying Stokes&apos; Law (<MathFormula tex="v \propto r^2" />).
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-300">
              2. Apparatus Required
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>Tall transparent graduated glass cylinder (inner diameter <MathFormula tex="D" />, height <MathFormula tex="H" />)</li>
              <li>Viscous fluid column ({liquidName}, <MathFormula tex="\rho_l = ${env.liquidDensityKgM3}\text{ kg/m}^3" />)</li>
              <li>Precision test spheres tested one at a time ({radiiSummaryText})</li>
              <li>Digital stopwatch / optical timing gates separated by distance <MathFormula tex="L" />, micrometer screw gauge, meter scale</li>
            </ul>
          </div>
        </div>

        {/* Theory & Mathematical Formulas */}
        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-300">
            3. Theory &amp; Mathematical Formulas
          </h4>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
            When a single sphere of radius <MathFormula tex="r" /> and density <MathFormula tex="\rho_b" /> falls
            vertically through an infinite viscous medium of density <MathFormula tex="\rho_l" /> and viscosity{' '}
            <MathFormula tex="\eta" /> under gravity <MathFormula tex="g" />, it experiences downward weight{' '}
            <MathFormula tex="F_g = \frac{4}{3}\pi r^3 \rho_b g" />, upward buoyant force{' '}
            <MathFormula tex="F_b = \frac{4}{3}\pi r^3 \rho_l g" />, and upward Stokes viscous drag{' '}
            <MathFormula tex="F_d = 6\pi\eta r v" />. At terminal velocity <MathFormula tex="v" />, net force vanishes (<MathFormula tex="F_b + F_d = F_g" />).
            In a finite laboratory cylinder of radius <MathFormula tex="R" /> and fluid height <MathFormula tex="H" />, Ladenburg&apos;s wall and bottom corrections restore the true unbounded terminal velocity:
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
              <div className="text-[11px] text-slate-400 mb-1">Observed &amp; Ladenburg Correction</div>
              <MathFormula displayMode tex="v' = \frac{L}{T}, \quad v = v'\left(1 + 2.4\frac{r}{R}\right)\left(1 + 3.3\frac{r}{H}\right)" />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
              <div className="text-[11px] text-slate-400 mb-1">Coefficient of Viscosity</div>
              <MathFormula displayMode tex="\eta = \frac{2(\rho_b - \rho_l)gr^2}{9v} = \frac{2(\rho_b - \rho_l)g}{9 \cdot \text{Slope}}" />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
              <div className="text-[11px] text-slate-400 mb-1">Reynolds Number Validity</div>
              <MathFormula displayMode tex="Re = \frac{\rho_l (2r) v}{\eta} \ll 1" />
            </div>
          </div>
        </div>

        {/* Input Parameters */}
        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-300">
            4. Active Apparatus Parameters
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:grid-cols-7">
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 block">Liquid Density ρl</span>
              <span className="font-mono text-sm font-semibold text-slate-100">{env.liquidDensityKgM3} kg/m³</span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 block">Ball Density ρb</span>
              <span className="font-mono text-sm font-semibold text-slate-100">{env.ballDensityKgM3} kg/m³</span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 block">Inner Diameter D</span>
              <span className="font-mono text-sm font-semibold text-slate-100">{env.cylinderDiameterMm} mm</span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 block">Inner Radius R</span>
              <span className="font-mono text-sm font-semibold text-slate-100">{(env.cylinderDiameterMm / 2).toFixed(2)} mm</span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 block">Column Height H</span>
              <span className="font-mono text-sm font-semibold text-slate-100">{env.columnHeightMm} mm</span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 block">Gravity g</span>
              <span className="font-mono text-sm font-semibold text-slate-100">{env.gravityMs2} m/s²</span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 block">
                {env.useAutoExperimentalViscosity && summary.averageViscosityPas !== null
                  ? 'Synced Theory η̄'
                  : 'Reference η'}
              </span>
              <span className="font-mono text-sm font-semibold text-cyan-300">
                {(summary.activeTheoreticalViscosityPas ?? env.referenceViscosityPas).toFixed(4)} Pa·s
              </span>
            </div>
          </div>
        </div>

        {/* Sequential Saved Observation Table */}
        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-300">
            5. Sequential Observation &amp; Calculation Table ({summary.results.length} Saved {summary.results.length === 1 ? 'Reading' : 'Readings'})
          </h4>
          {summary.results.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-300">
                    <th className="py-2 pr-2">Reading</th>
                    <th className="py-2 px-2 text-right">r (mm)</th>
                    <th className="py-2 px-2 text-right">r² (mm²)</th>
                    <th className="py-2 px-2 text-right">L (mm)</th>
                    <th className="py-2 px-2 text-right">T (s)</th>
                    <th className="py-2 px-2 text-right">v&apos; (m/s)</th>
                    <th className="py-2 px-2 text-right">f₁</th>
                    <th className="py-2 px-2 text-right">f₂</th>
                    <th className="py-2 px-2 text-right">v (m/s)</th>
                    <th className="py-2 px-2 text-right">η (Pa·s)</th>
                    <th className="py-2 px-2 text-right">Re</th>
                    <th className="py-2 pl-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {summary.results.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-2 font-sans text-slate-200">{r.label}</td>
                      <td className="py-2 px-2 text-right">{r.radiusMm.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">{r.radiusSqMm2.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">{r.lengthMm.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right">{r.timeS < 0.1 ? r.timeS.toFixed(5) : r.timeS.toFixed(3)}</td>
                      <td className="py-2 px-2 text-right">{r.observedVelocityMs.toFixed(5)}</td>
                      <td className="py-2 px-2 text-right">{r.wallCorrectionF1.toFixed(4)}</td>
                      <td className="py-2 px-2 text-right">{r.bottomCorrectionF2.toFixed(4)}</td>
                      <td className="py-2 px-2 text-right text-cyan-300">{r.correctedVelocityMs.toFixed(5)}</td>
                      <td className="py-2 px-2 text-right font-semibold text-slate-100">
                        {r.viscosityPas !== null ? r.viscosityPas.toFixed(4) : 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {r.reynoldsNumber !== null ? r.reynoldsNumber.toFixed(3) : 'N/A'}
                      </td>
                      <td
                        className={`py-2 pl-2 text-right font-sans text-[11px] font-medium ${
                          r.reynoldsStatus === 'valid'
                            ? 'text-emerald-400'
                            : r.reynoldsStatus === 'caution'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                        }`}
                      >
                        {r.reynoldsStatus === 'valid'
                          ? 'Valid'
                          : r.reynoldsStatus === 'caution'
                            ? 'Caution'
                            : 'Excluded'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
              No sequential readings saved yet. Run the single-ball experiment and click &quot;Save Reading&quot; to record data rows into this report.
            </div>
          )}

          {summary.excludedResults.length > 0 && (
            <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
              Excluded from mean η̄ and Stokes fit:{' '}
              {summary.excludedResults
                .map((r) => `${r.label} (${r.exclusionReason ?? 'outside Stokes regime'})`)
                .join(' · ')}
            </div>
          )}
        </div>

        {/* Sample Step-by-Step Calculation & Graph */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-300">
              6. Representative Calculation ({sampleResult.label})
            </h4>
            <div className="mt-2 space-y-1.5 font-mono text-xs text-slate-300">
              <p>r = {sampleResult.radiusM.toExponential(3)} m, R = {sampleResult.cylinderRadiusM.toExponential(3)} m, H = {sampleResult.columnHeightM.toFixed(3)} m</p>
              <p>v&apos; = L / T = {sampleResult.lengthM.toFixed(3)} / {sampleResult.timeS < 0.1 ? sampleResult.timeS.toFixed(5) : sampleResult.timeS.toFixed(3)} = {sampleResult.observedVelocityMs.toFixed(5)} m/s</p>
              <p>f₁ = 1 + 2.4(r/R) = {sampleResult.wallCorrectionF1.toFixed(4)}</p>
              <p>f₂ = 1 + 3.3(r/H) = {sampleResult.bottomCorrectionF2.toFixed(4)}</p>
              <p>v = v&apos; × f₁ × f₂ = {sampleResult.correctedVelocityMs.toFixed(5)} m/s</p>
              <p className="text-cyan-300 font-semibold">
                η = 2(ρb−ρl)gr² / (9v) = {sampleResult.viscosityPas !== null ? `${sampleResult.viscosityPas.toFixed(4)} Pa·s` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-300 mb-2">
              7. Regression Plot (v vs r²)
            </h4>
            <PrimaryVR2Chart summary={summary} showObservedOverlay={false} heightClass="h-52" />
          </div>
        </div>

        {/* Result, Conclusion, Precautions, Error Sources */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-4 md:grid-cols-3">
          <div>
            <span className="text-xs text-slate-400 block">Mean Coefficient of Viscosity (η̄)</span>
            <span className="font-mono text-xl font-bold text-slate-100">
              {summary.averageViscosityPas !== null ? `${summary.averageViscosityPas.toFixed(4)} Pa·s` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Graph-Derived Viscosity (η_graph)</span>
            <span className="font-mono text-xl font-bold text-cyan-300">
              {summary.graphDerivedViscosityPas !== null ? `${summary.graphDerivedViscosityPas.toFixed(4)} Pa·s` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">
              Origin Fit Linearity (R²)
            </span>
            <span className="font-mono text-xl font-bold text-emerald-400">
              {summary.graphRSquared !== null
                ? summary.graphRSquared.toFixed(5)
                : summary.rSquaredStatus === 'mixed_conditions'
                  ? 'N/A (mixed)'
                  : summary.rSquaredStatus === 'same_radius'
                    ? 'N/A (1 radius)'
                    : summary.acceptedResults.length === 1
                      ? 'N/A (< 2 pts)'
                      : 'N/A'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 text-xs leading-relaxed text-slate-300">
          <div>
            <h4 className="font-display text-sm font-semibold text-slate-100 mb-1.5">8. Conclusion &amp; Observations</h4>
            <p>
              {summary.hasCriticalDensityError
                ? 'With ρb ≤ ρl, downward Stokes settling cannot occur; buoyancy prevents sedimentation.'
                : summary.acceptedResults.length === 0
                  ? 'No accepted Stokes-regime saved readings (Re < 1.0) are present; save trials with smaller sphere radii or a higher-viscosity fluid to verify Stokes’ Law.'
                  : summary.hasMixedMediumConditions
                    ? `${summary.acceptedResults.length} accepted readings span multiple fluid or sphere/gravity conditions; individual viscosity values ηᵢ remain valid per reading, while pooled single-slope v vs r² regression is disabled.`
                    : `Across ${summary.acceptedResults.length} accepted sequential single-ball readings, corrected terminal velocity increases linearly with r² (${
                        summary.graphRSquared !== null
                          ? `R² = ${summary.graphRSquared.toFixed(4)}`
                          : summary.rSquaredStatus === 'same_radius'
                            ? 'save readings at ≥ 2 distinct radii for R²'
                            : 'save ≥ 2 readings at different radii for R²'
                      }). Mean viscosity (${summary.averageViscosityPas?.toFixed(4) ?? '—'} Pa·s) agrees with the graphical method (${summary.graphDerivedViscosityPas?.toFixed(4) ?? '—'} Pa·s).`}
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-slate-100 mb-1.5">9. Precautions</h4>
            <ul className="list-disc space-y-1 pl-4">
              <li>Release one sphere at a time gently along the central axis without imparting initial velocity or spin.</li>
              <li>Place top timing mark A sufficiently below the meniscus so terminal velocity is achieved before timing begins.</li>
              <li>Ensure the fluid is free of air bubbles and maintained at uniform temperature across all sequential trials.</li>
              <li>Clean and dry each sphere thoroughly before measuring diameter with a micrometer.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-slate-100 mb-1.5">10. Sources of Error</h4>
            <ul className="list-disc space-y-1 pl-4">
              <li>Parallax error while observing sphere transit across reference marks A and B.</li>
              <li>Human reaction-time lag in starting and stopping the stopwatch.</li>
              <li>Temperature fluctuations altering true fluid viscosity exponentially between trials.</li>
              <li>Off-center descent or non-negligible Reynolds number (Re ≥ 0.5) introducing inertial drag.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
