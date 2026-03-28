import { useEffect } from 'react';

function animateCounter(el: HTMLElement, target: number, duration = 1500) {
  const isFloat = !Number.isInteger(target);
  const decimals = isFloat ? String(target).split('.')[1]?.length ?? 1 : 0;
  const start = performance.now();

  const step = (timestamp: number) => {
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);
    // Cubic ease-out
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    el.textContent = isFloat ? current.toFixed(decimals) : Math.round(current).toString();
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target.toString();
    }
  };

  requestAnimationFrame(step);
}

export function useCounterUp(selector = '.counter') {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (els.length === 0) return;

    const observers: IntersectionObserver[] = [];

    els.forEach(el => {
      // Store original value once
      if (!el.dataset.counterOriginal) {
        el.dataset.counterOriginal = el.textContent?.trim() ?? '0';
      }
      const originalText = el.dataset.counterOriginal;
      const target = parseFloat(originalText.replace(/[^0-9.]/g, ''));
      if (isNaN(target)) return;

      // Reset to 0 before animating
      el.textContent = '0';

      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        // Already in viewport — animate immediately
        animateCounter(el, target);
      } else {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              animateCounter(el, target);
              observer.disconnect();
            }
          },
          { threshold: 0.3 }
        );
        observer.observe(el);
        observers.push(observer);
      }
    });

    return () => {
      observers.forEach(o => o.disconnect());
    };
  }, [selector]);
}
