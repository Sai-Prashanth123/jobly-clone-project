import { useEffect, useRef } from 'react';

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  animation = 'animate__fadeInUp',
  threshold = 0.15,
  delay = '0s'
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      el.style.animationDelay = delay;
      el.classList.add('animate__animated', animation);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.animationDelay = delay;
          el.classList.add('animate__animated', animation);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animation, threshold, delay]);

  return ref;
}
