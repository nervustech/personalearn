"use client";

import { useEffect, useState } from "react";

/** Matches Tailwind `md` breakpoint (768px). True when viewport is below md. */
export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [breakpointPx]);

  return isMobile;
}
