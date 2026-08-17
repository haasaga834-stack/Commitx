import { useEffect, useState } from "react";

/** Tablet breakpoint: anything with a viewport at least this wide gets the
 *  dedicated tablet dashboard shell. Phones stay on the mobile UI. */
export const TABLET_MIN_WIDTH = 768;

/**
 * True when the viewport is tablet-sized (portrait or landscape).
 * Starts false so SSR/hydration always match, then resolves on mount and
 * follows resize / orientation changes.
 */
export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH}px)`);
    const apply = () => setIsTablet(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return isTablet;
}
