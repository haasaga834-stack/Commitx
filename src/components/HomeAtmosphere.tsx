import { useEffect, useState } from "react";
import mountains from "@/assets/home-mountain-panorama.jpg";
function Bird({ perched = false }: { perched?: boolean }) {
  return <svg viewBox="0 0 40 24" fill="none" aria-hidden className={perched ? "cx-home-perched" : "cx-home-bird-shape"}>
    {perched ? <><path d="M9 19l6-6c-1-7 9-9 12-4l5 2-5 2c-1 6-7 8-12 4l-6 2Z" fill="currentColor"/><path d="M20 18v4m4-4v4" stroke="currentColor"/></> : <path d="M2 8c8-3 14 1 18 7 4-6 10-10 18-7-9-1-13 7-18 9C15 15 11 7 2 8Z" fill="currentColor"/>}
  </svg>;
}
export function PerchedBird() { return <Bird perched />; }
export function HomeAtmosphere() {
  const [paused, setPaused] = useState(false);
  useEffect(() => { const update = () => setPaused(document.hidden); document.addEventListener("visibilitychange", update); return () => document.removeEventListener("visibilitychange", update); }, []);
  return <div className={`cx-home-atmosphere ${paused ? "cx-home-paused" : ""}`} aria-hidden>
    <img src={mountains} alt="" width={1024} height={1920} className="cx-home-panorama" />
    <div className="cx-home-scenic-wash" />
    {[0, 1, 2, 3].map(i => <span key={i} className={`cx-home-bird cx-home-bird-${i}`}><Bird /></span>)}
  </div>;
}