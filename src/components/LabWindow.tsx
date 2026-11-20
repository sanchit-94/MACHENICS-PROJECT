import { useEffect, useRef, useState, type ReactNode } from 'react';

export type SlideDirection = 'left' | 'right' | 'up';

interface LabWindowProps {
  id: string;
  chapterLabel: string;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  slideDirection?: SlideDirection;
}

export function LabWindow({
  id,
  chapterLabel,
  title,
  subtitle,
  headerRight,
  children,
  className = '',
  slideDirection = 'up',
}: LabWindowProps) {
  const ref = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf1 = 0;
    let raf2 = 0;
    let revealed = false;

    const triggerReveal = () => {
      if (revealed) return;
      revealed = true;
      // Double-rAF guarantees the browser paints the off-offset state before sliding in
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setEntered(true);
        });
      });
    };

    const isVisibleOrAbove = () => {
      const rect = el.getBoundingClientRect();
      return rect.top <= window.innerHeight * 0.96;
    };

    if (isVisibleOrAbove() || typeof IntersectionObserver === 'undefined') {
      triggerReveal();
    }

    const obs =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting || entry.boundingClientRect.top <= window.innerHeight * 0.96) {
                  triggerReveal();
                  obs?.disconnect();
                }
              }
            },
            { threshold: 0.03, rootMargin: '0px 0px -20px 0px' },
          )
        : null;

    if (obs && !revealed) {
      obs.observe(el);
    }

    const handleScrollOrHash = () => {
      if (revealed) return;
      if (window.location.hash === `#${id}` || isVisibleOrAbove()) {
        triggerReveal();
        obs?.disconnect();
      }
    };

    window.addEventListener('scroll', handleScrollOrHash, { passive: true });
    window.addEventListener('hashchange', handleScrollOrHash);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      obs?.disconnect();
      window.removeEventListener('scroll', handleScrollOrHash);
      window.removeEventListener('hashchange', handleScrollOrHash);
    };
  }, [id]);

  const directionClass =
    slideDirection === 'left'
      ? 'slide-from-left'
      : slideDirection === 'right'
        ? 'slide-from-right'
        : 'slide-from-up';

  return (
    <section
      id={id}
      ref={ref}
      data-revealed={entered ? 'true' : 'false'}
      className={`lab-window window-reveal ${directionClass} rounded-2xl p-5 sm:p-7 scroll-mt-20 ${
        entered ? '' : 'is-entering'
      } ${className}`}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="text-xs font-medium text-cyan-400">{chapterLabel}</div>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 max-w-3xl text-sm text-slate-400">{subtitle}</p>
          )}
        </div>
        {headerRight && <div className="max-w-full sm:shrink-0">{headerRight}</div>}
      </div>
      {children}
    </section>
  );
}
