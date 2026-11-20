import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

const STARFIELD_POINTS: Array<{ cx: number; cy: number; r: number; o: number }> = [
  { cx: 7, cy: 14, r: 0.9, o: 0.65 },
  { cx: 14, cy: 36, r: 0.7, o: 0.4 },
  { cx: 19, cy: 9, r: 1.1, o: 0.75 },
  { cx: 26, cy: 27, r: 0.65, o: 0.38 },
  { cx: 33, cy: 16, r: 0.95, o: 0.6 },
  { cx: 41, cy: 42, r: 0.7, o: 0.45 },
  { cx: 48, cy: 12, r: 1.2, o: 0.8 },
  { cx: 55, cy: 29, r: 0.8, o: 0.5 },
  { cx: 62, cy: 8, r: 0.75, o: 0.42 },
  { cx: 69, cy: 22, r: 1.05, o: 0.72 },
  { cx: 74, cy: 44, r: 0.7, o: 0.35 },
  { cx: 81, cy: 15, r: 1.15, o: 0.78 },
  { cx: 88, cy: 33, r: 0.8, o: 0.48 },
  { cx: 93, cy: 11, r: 0.9, o: 0.68 },
  { cx: 11, cy: 62, r: 0.7, o: 0.42 },
  { cx: 23, cy: 76, r: 1.0, o: 0.64 },
  { cx: 37, cy: 68, r: 0.65, o: 0.36 },
  { cx: 52, cy: 81, r: 0.9, o: 0.58 },
  { cx: 66, cy: 59, r: 0.75, o: 0.46 },
  { cx: 79, cy: 74, r: 1.1, o: 0.7 },
  { cx: 91, cy: 64, r: 0.75, o: 0.44 },
  { cx: 4, cy: 86, r: 0.85, o: 0.55 },
  { cx: 96, cy: 84, r: 0.95, o: 0.62 },
];

export function InstitutionalFooter() {
  const [logoError, setLogoError] = useState(false);
  const footerRef = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;

    let revealed = false;
    let raf1 = 0;
    let raf2 = 0;

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setEntered(true));
      });
    };

    const checkVisible = () => el.getBoundingClientRect().top <= window.innerHeight * 0.98;

    if (checkVisible() || typeof IntersectionObserver === 'undefined') {
      reveal();
    }

    const obs =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting || e.boundingClientRect.top <= window.innerHeight * 0.98)) {
                reveal();
                obs?.disconnect();
              }
            },
            { threshold: 0.02 },
          )
        : null;

    if (obs && !revealed) obs.observe(el);

    const onScroll = () => {
      if (!revealed && checkVisible()) {
        reveal();
        obs?.disconnect();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      obs?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      data-testid="nasa-inspired-footer"
      data-revealed={entered ? 'true' : 'false'}
      className={`no-print window-reveal slide-from-up relative mt-16 overflow-hidden border-t border-sky-400/20 bg-[#02050d] text-slate-100 ${
        entered ? '' : 'is-entering'
      }`}
    >
      {/* Atmospheric Deep-Space Lighting & Starfield Canvas (original geometric composition) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 60% at 50% 0%, rgba(14, 116, 144, 0.18) 0%, rgba(15, 23, 42, 0.55) 45%, rgba(2, 5, 13, 1) 82%)',
        }}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-75"
      >
        {STARFIELD_POINTS.map((star, idx) => (
          <circle
            key={idx}
            cx={star.cx}
            cy={star.cy}
            r={star.r * 0.14}
            fill="#e0f2fe"
            fillOpacity={star.o}
          />
        ))}
        {/* Subtle orbital trajectory arc & horizon limb */}
        <path
          d="M -10 92 Q 50 64 110 92"
          fill="none"
          stroke="rgba(56, 189, 248, 0.22)"
          strokeWidth="0.22"
        />
        <path
          d="M -10 96 Q 50 72 110 96"
          fill="none"
          stroke="rgba(148, 163, 184, 0.12)"
          strokeWidth="0.16"
        />
      </svg>

      <div className="relative mx-auto max-w-[1440px] px-6 py-14 sm:py-16 lg:py-20">
        {/* Top Cinematic Statement & Quick Navigation */}
        <div className="grid grid-cols-1 gap-10 border-b border-slate-800/80 pb-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7 space-y-4">
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">
              Engineering Physics Mechanics · Virtual Laboratory Archive
            </div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[44px] lg:leading-[1.08] [text-wrap:balance]">
              Precision Fluid Mechanics in Three Dimensions.
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              Built for rigorous classroom demonstration and sequential falling-sphere inquiry—uniting real-time
              Stokes creeping-flow dynamics, Ladenburg finite-cylinder corrections, and Reynolds-validated
              regression diagnostics in a self-contained scientific instrument.
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-col items-start lg:items-end gap-4">
            <nav
              aria-label="Laboratory Footer Navigation"
              className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm text-slate-300 sm:grid-cols-3 lg:text-right"
            >
              <a href="#top" className="hover:text-cyan-300 transition-colors inline-flex items-center gap-1 lg:justify-end">
                <span>Overview</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </a>
              <a href="#apparatus-window" className="hover:text-cyan-300 transition-colors inline-flex items-center gap-1 lg:justify-end">
                <span>3D Apparatus</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </a>
              <a href="#observation-window" className="hover:text-cyan-300 transition-colors inline-flex items-center gap-1 lg:justify-end">
                <span>Single-Ball Lab</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </a>
              <a href="#graphs-window" className="hover:text-cyan-300 transition-colors inline-flex items-center gap-1 lg:justify-end">
                <span>Graph Suite</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </a>
              <a href="#comparison-window" className="hover:text-cyan-300 transition-colors inline-flex items-center gap-1 lg:justify-end">
                <span>Scaling Analysis</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </a>
              <a href="#report-window" className="hover:text-cyan-300 transition-colors inline-flex items-center gap-1 lg:justify-end">
                <span>Lab Report</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </a>
            </nav>
          </div>
        </div>

        {/* Institutional Identity & Single Developer Credit */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          {/* Official College Emblem & Full Name */}
          <div className="lg:col-span-8 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-white p-1.5 shadow-lg">
              {!logoError ? (
                <img
                  src="/assets/aistudio/images_eb0586ab.jpg"
                  alt="IIITDM Jabalpur Official Emblem"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-display text-xs font-extrabold text-slate-900 text-center">
                  IIITDMJ
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="font-display text-xs font-bold tracking-[0.16em] text-cyan-300">
                IIITDM JABALPUR
              </div>
              <div className="font-display text-base font-bold tracking-wide text-white sm:text-lg [text-wrap:balance]">
                INDIAN INSTITUTE OF INFORMATION TECHNOLOGY, DESIGN AND MANUFACTURING JABALPUR
              </div>
              <div className="pt-1 font-display text-xs font-semibold tracking-wider text-slate-200">
                STOKES&apos; LAW – INTERACTIVE 3D VIRTUAL PHYSICS LABORATORY
              </div>
              <p className="text-xs text-slate-400">
                Developed as an Interactive Engineering Physics Laboratory Project.
              </p>
            </div>
          </div>

          {/* Team Members / Developer Credits */}
          <div className="lg:col-span-4 rounded-xl border border-sky-400/20 bg-[#070d1f]/90 p-5">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              PROJECT TEAM / DEVELOPED BY
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-4 border-b border-slate-800/80 pb-1.5">
                <dt className="text-xs text-slate-400">Name:</dt>
                <dd className="font-display font-semibold text-white">Sanchit Tupsakhare</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 pt-0.5">
                <dt className="text-xs text-slate-400">Roll No.:</dt>
                <dd className="font-mono font-semibold text-cyan-300">26BCS217</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </footer>
  );
}
