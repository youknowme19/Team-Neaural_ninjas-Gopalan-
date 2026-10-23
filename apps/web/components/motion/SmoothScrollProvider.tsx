'use client';

import { useEffect, ReactNode } from 'react';
import Lenis from 'lenis';

interface SmoothScrollProviderProps {
  children: ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const animId = requestAnimationFrame(raf);

    function handleIntro(e: Event) {
      const customEvent = e as CustomEvent<'play' | 'done'>;
      if (customEvent.detail === 'play') {
        lenis.stop();
      } else if (customEvent.detail === 'done') {
        lenis.start();
      }
    }

    window.addEventListener('livespeak:intro', handleIntro);

    return () => {
      window.removeEventListener('livespeak:intro', handleIntro);
      cancelAnimationFrame(animId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
