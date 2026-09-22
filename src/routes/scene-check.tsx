import { createFileRoute } from "@tanstack/react-router";
import { SessionScene } from "@/components/SessionScene";

export const Route = createFileRoute("/scene-check")({ ssr: false, component: Check });

function Check() {
  const themes = ["tree", "fireflies", "moon", "lotus"] as const;
  const steps = [0.05, 0.3, 0.55, 0.8, 1];
  return (
    <div className="grid grid-cols-5 gap-2 p-2">
      {themes.map((t) =>
        steps.map((s) => (
          <div key={`${t}${s}`} className="relative h-56 overflow-hidden rounded-xl">
            <SessionScene theme={t} progress={s} />
          </div>
        )),
      )}
    </div>
  );
}
