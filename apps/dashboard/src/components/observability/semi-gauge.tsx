import { useEffect } from "react";
import { motion, useMotionValue, animate } from "motion/react";

const TICK_COUNT = 24;
const G = 118;
const OUTER_R = 108;
const INNER_R = 78;
const LINE_W = 5;
const START_ANGLE = 174;
const END_ANGLE = 6;

const TICK_COLORS = [
  "#22c55e",
  "#2dd46b",
  "#3ee377",
  "#5bea8a",
  "#78f29e",
  "#9ae53b",
  "#b5e840",
  "#cdec44",
  "#e5d030",
  "#f0c020",
  "#f5b020",
  "#f5a623",
  "#f09418",
  "#eb7d15",
  "#e86b11",
  "#e5590e",
  "#e04a0c",
  "#dc3c0a",
  "#d63027",
  "#d02824",
  "#cc2222",
  "#c41e1e",
  "#bb1a1a",
  "#b01616",
];

const LINES = Array.from({ length: TICK_COUNT }, (_, i) => {
  const angleDeg = START_ANGLE - (i / (TICK_COUNT - 1)) * (START_ANGLE - END_ANGLE);
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const len = OUTER_R + 30;
  return {
    x1: G - len * cos,
    y1: G + len * sin,
    x2: G + len * cos,
    y2: G - len * sin,
    index: i,
  };
});

function AnimatedTick({ line, isActive, delay }: { line: (typeof LINES)[number]; isActive: boolean; delay: number }) {
  return (
    <motion.line
      x1={line.x1}
      y1={line.y1}
      x2={line.x2}
      y2={line.y2}
      stroke={isActive ? TICK_COLORS[line.index] : "var(--color-dash-border-soft)"}
      strokeWidth={LINE_W}
      strokeLinecap="round"
      initial={isActive ? { opacity: 0 } : { opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={isActive ? { duration: 0.15, delay } : { duration: 0 }}
    />
  );
}

export function SemiGauge({
  value,
  max,
  label,
  valueLabel,
  title,
  subtitle,
}: {
  value: number;
  max: number;
  label: string;
  valueLabel: string;
  title: string;
  subtitle: string;
}) {
  const ratio = Math.min(value, max) / max;
  const activeTicks = ratio > 0 ? Math.max(2, Math.round(ratio * TICK_COUNT)) : 0;

  const progress = useMotionValue(0);

  useEffect(() => {
    progress.set(0);
    const controls = animate(progress, 1, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value]);

  return (
    <div className="flex flex-1 flex-col rounded-lg border-[0.5px] border-dash-border-soft bg-dash-bg">
      <div className="flex min-h-[72px] items-center border-b-[0.5px] border-dash-border-soft px-4 py-3 sm:px-5 sm:py-0">
        <div>
          <h3 className="text-sm text-dash-text-strong">{title}</h3>
          <p className="text-sm font-light text-dash-text-faded">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-4 px-4 py-5 sm:flex-row sm:items-center sm:gap-0 sm:px-5 sm:py-6">
        <div className="w-full shrink-0 sm:w-auto">
          <svg width="200" height="110" viewBox="0 0 236 130" fill="none" className="mx-auto sm:mx-0">
            <defs>
              <clipPath id={`gauge-clip-${label}`}>
                <path
                  d={`M ${G - OUTER_R},${G} A ${OUTER_R},${OUTER_R} 0 0,1 ${G + OUTER_R},${G} L ${G + INNER_R},${G} A ${INNER_R},${INNER_R} 0 0,0 ${G - INNER_R},${G} Z`}
                />
              </clipPath>
            </defs>

            <g clipPath={`url(#gauge-clip-${label})`}>
              {LINES.map((line) => {
                const isActive = line.index < activeTicks;
                const delay = isActive ? (line.index / activeTicks) * 0.6 : 0;
                return <AnimatedTick key={line.index} line={line} isActive={isActive} delay={delay} />;
              })}
            </g>
          </svg>
        </div>

        <div className="w-full border-t border-[#ebebeb] pt-4 sm:ml-5 sm:w-auto sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 dark:border-dash-border">
          <span className="block text-base text-dash-text-strong">{label}</span>
          <span className="block font-logs text-sm text-dash-text-faded">{valueLabel}</span>
        </div>
      </div>
    </div>
  );
}
