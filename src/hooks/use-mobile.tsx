import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Computed synchronously on the first render (not left `undefined` until a
// post-mount effect) so consumers never see a transient "not mobile" value —
// that transient false previously caused mobile-only UI (e.g. the sidebar
// toggle) to be entirely absent from the DOM for the first render frame.
function getIsMobile(): boolean {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
