import { useEffect, useState } from "react";
const poster = "/events/skillsphere-elocution.jpg";

const EVENT_URL = "https://skillsphereedu.vercel.app/events";
const EXPIRES_AT = new Date("2026-11-30T23:59:59+05:30").getTime();

/** Time-limited community spotlight; hidden after Nov 30, 2026 and in the native app. */
export function EventSpotlight() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const native = document.body.classList.contains("android-bridge") || "CommitXNative" in window;
    setShow(!native && Date.now() <= EXPIRES_AT);
  }, []);
  if (!show) return null;
  return (
    <section className="px-6 py-12 sm:py-16" aria-label="Community spotlight">
      <div className="mx-auto max-w-md text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
          Community Spotlight
        </p>
        <a
          href={EVENT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 block overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <img src={poster} alt="SkillSphere Edu Elocution event poster" loading="lazy" className="block w-full" />
        </a>
        <p className="mt-4 text-sm text-ink-soft">
          SkillSphere Edu student events —{" "}
          <a href={EVENT_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            view & register
          </a>
        </p>
      </div>
    </section>
  );
}
