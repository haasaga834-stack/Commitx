import { useEffect, useState } from "react";

/** Tablet breakpoint: anything with a viewport at least this wide gets the
 *  dedicated tablet dashboard shell. Phones stay on the mobile UI. */
export const TABLET_MIN_WIDTH = 700;

/**
 * Tablet when the viewport is wide enough for the two-column shell:
 * 700px+ with a tall-enough viewport (portrait/landscape tablets and the
 * editor's tablet preview), or anything 900px+ regardless of height.
 * Landscape phones (short viewports) stay on the mobile UI.
 */
export const TABLET_MEDIA_QUERY =
  `(min-width: ${TABLET_MIN_WIDTH}px) and (min-height: 560px), (min-width: 900px)`;

/**
 * True when the viewport is tablet-sized (portrait or landscape).
 * Starts false so SSR/hydration always match, then resolves on mount and
 * follows resize / orientation changes.
 */
export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(TABLET_MEDIA_QUERY);
    const apply = () => setIsTablet(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return isTablet;
}


  return isTablet;
}
