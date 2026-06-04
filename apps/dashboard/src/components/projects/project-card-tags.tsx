import * as RadixTooltip from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import type { Tag } from "@/types/tags";

interface ProjectCardTagsProps {
  tags: Tag[];
  maxVisible?: number;
  /** Override the trigger row classes (layout/padding). Defaults to the card layout. */
  className?: string;
  /** Render tag name labels next to the dots. Set false for a compact dots-only row. */
  showLabels?: boolean;
}

const springTransition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
  mass: 0.8,
};

export function ProjectCardTags({ tags, maxVisible = 2, className, showLabels = true }: ProjectCardTagsProps) {
  const [open, setOpen] = useState(false);
  if (tags.length === 0) return null;

  const visible = tags.slice(0, maxVisible);
  const overflow = tags.length - maxVisible;
  const showTooltip = tags.length > 1;

  const trigger = (
    <div className={className ?? "flex items-center gap-2 pb-1.5 pl-[19px] pr-3.5"}>
      {visible.map((tag) => (
        <span key={tag.id} className="flex items-center gap-1.5">
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
          {showLabels ? <span className="text-xs text-dash-text-faded">{tag.name}</span> : null}
        </span>
      ))}
      {overflow > 0 && (
        <span className="rounded-full bg-dash-bg-elevated px-1.5 py-0.5 text-[10px] leading-none text-dash-text-extra-faded">
          +{overflow}
        </span>
      )}
    </div>
  );

  if (!showTooltip) return trigger;

  return (
    <RadixTooltip.Root open={open} onOpenChange={setOpen} delayDuration={150}>
      <RadixTooltip.Trigger asChild>{trigger}</RadixTooltip.Trigger>

      <AnimatePresence>
        {open && (
          <RadixTooltip.Portal forceMount>
            <RadixTooltip.Content side="top" sideOffset={6} asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 6 }}
                transition={springTransition}
                className="z-50 flex flex-col gap-1 rounded-md border border-[#141414] bg-gradient-to-b from-[#434343] to-[#232323] px-2.5 py-1.5 shadow-[0px_0.6px_0px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.18),inset_0px_1px_0px_rgba(255,255,255,0.18)]"
              >
                {tags.map((tag) => (
                  <span key={tag.id} className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="text-xs leading-5 tracking-[-0.019px] text-white">{tag.name}</span>
                  </span>
                ))}
              </motion.div>
            </RadixTooltip.Content>
          </RadixTooltip.Portal>
        )}
      </AnimatePresence>
    </RadixTooltip.Root>
  );
}
