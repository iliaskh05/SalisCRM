import { useState } from "react";
import { cn } from "@/lib/utils";

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Avant",
  afterLabel = "Après",
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [pos, setPos] = useState(50);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[3/2] w-full select-none">
        <img src={afterSrc} alt={afterLabel} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={beforeSrc} alt={beforeLabel} className="size-full object-cover" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
        <div
          className="pointer-events-none absolute top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-ink/80 text-[10px] font-bold text-white"
          style={{ left: `${pos}%` }}
        >
          ↔
        </div>
        <span className="absolute top-3 left-3 rounded bg-ink/70 px-2 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
          {beforeLabel}
        </span>
        <span className="absolute top-3 right-3 rounded bg-teal-700/80 px-2 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
          {afterLabel}
        </span>
        <input
          type="range"
          min={1}
          max={99}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className={cn("absolute inset-0 h-full w-full cursor-ew-resize opacity-0")}
          aria-label="Comparer avant et après"
        />
      </div>
    </div>
  );
}
