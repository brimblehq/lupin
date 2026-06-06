import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/**
 * True when the viewport is below the `md` breakpoint. Defaults to `false`
 * (desktop) on the server and first paint, then corrects after mount.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}
