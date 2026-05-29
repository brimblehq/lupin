import { useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { cn } from "@brimble/ui";
import type { AnnouncementContent } from "@/backend/messages";
import { DashButton } from "./dash-button";

const ROTATE_INTERVAL_MS = 5000;

interface AnnouncementSlideoutProps {
  announcements: AnnouncementContent[];
  onDismiss: (id: string) => void;
  onCta: (announcement: AnnouncementContent) => void;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function AnnouncementSlideout({ announcements, onDismiss, onCta }: AnnouncementSlideoutProps) {
  const [index, setIndex] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [imgErrorIds, setImgErrorIds] = useState<Set<string>>(() => new Set());
  const prefersReducedMotion = usePrefersReducedMotion();

  const count = announcements.length;
  const hasMultiple = count > 1;
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;
  const current = announcements[safeIndex];

  useEffect(() => {
    if (index > count - 1) setIndex(Math.max(0, count - 1));
  }, [count, index]);

  const autoPlay = hasMultiple && !manuallyPaused && !hovered && !focused && !prefersReducedMotion;

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoPlay, count, safeIndex]);

  if (!current) return null;

  const showImage = Boolean(current.imageUrl) && !imgErrorIds.has(current.id);
  const goPrev = () => setIndex((i) => (i - 1 + count) % count);
  const goNext = () => setIndex((i) => (i + 1) % count);

  const cardVariants: Variants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
      }
    : {
        initial: { opacity: 0, y: 28, scale: 0.96 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: "spring",
            stiffness: 320,
            damping: 30,
            mass: 0.9,
            opacity: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
          },
        },
        exit: {
          opacity: 0,
          y: 16,
          scale: 0.98,
          transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
        },
      };

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ transformOrigin: "bottom left" }}
      className="fixed bottom-3 left-3 right-3 z-40 sm:bottom-5 sm:right-auto sm:left-5 sm:w-[380px]"
      role="region"
      aria-label="Announcements"
      aria-roledescription={hasMultiple ? "carousel" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div className="relative flex flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_3px_rgba(0,0,0,0.06),inset_0px_-3px_2px_rgba(245,245,245,0.3)] dark:shadow-[0px_2px_3px_rgba(0,0,0,0.2)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col"
          >
            {showImage && (
              <div className="h-[120px] w-full shrink-0 overflow-hidden border-b-[0.5px] border-dash-border bg-dash-bg-elevated">
                <img
                  src={current.imageUrl}
                  alt={current.imageAlt ?? ""}
                  onError={() => setImgErrorIds((prev) => new Set(prev).add(current.id))}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="flex items-start justify-between gap-3 px-4 pt-4">
              <h3 className="text-sm font-semibold leading-[1.4] tracking-[-0.096px] text-dash-text-strong">{current.title}</h3>
              <button
                onClick={() => onDismiss(current.id)}
                aria-label="Dismiss announcement"
                className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="scrollbar-subtle max-h-[160px] overflow-y-auto px-4 pb-1 pt-2 text-sm leading-[1.45] text-dash-text-body">
              {current.body}
            </p>

            {current.learnMoreUrl && (
              <a
                href={current.learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-4 pb-1 pt-2 text-sm font-medium text-[#4879f8] transition-opacity hover:opacity-70"
              >
                Learn more
                <ArrowSquareOut className="size-3.5" />
              </a>
            )}
          </motion.div>
        </AnimatePresence>

        {hasMultiple && (
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                aria-label="Previous announcement"
                className="flex h-6 w-6 items-center justify-center rounded text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {announcements.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to announcement ${i + 1} of ${count}`}
                    aria-current={i === safeIndex}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === safeIndex ? "w-4 bg-dash-text-strong" : "w-1.5 bg-dash-border hover:bg-dash-text-faded",
                    )}
                  />
                ))}
              </div>
              <button
                onClick={goNext}
                aria-label="Next announcement"
                className="flex h-6 w-6 items-center justify-center rounded text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            {!prefersReducedMotion && (
              <button
                onClick={() => setManuallyPaused((p) => !p)}
                aria-label={manuallyPaused ? "Resume auto-rotation" : "Pause auto-rotation"}
                className="flex h-6 w-6 items-center justify-center rounded text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
              >
                {manuallyPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-4 pb-4 pt-3">
          <DashButton variant="outline" size="sm" onClick={() => onDismiss(current.id)}>
            Dismiss
          </DashButton>
          <DashButton variant="primary" size="sm" onClick={() => onCta(current)}>
            {current.ctaLabel}
          </DashButton>
        </div>
      </div>
    </motion.div>
  );
}
