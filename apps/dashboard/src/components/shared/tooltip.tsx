import * as RadixTooltip from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "motion/react";
import { useState, type ReactNode } from "react";

interface TooltipUserProps {
  name: string;
  role: string;
  avatarUrl?: string;
  avatarFallback?: string;
}

interface TooltipProps {
  children: ReactNode;
  user: TooltipUserProps;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  delayDuration?: number;
}

/**
 * Wrap the app/layout once. Controls global tooltip timing:
 * - 200ms open delay (snappy, not too eager)
 * - 0ms skip delay  (instant when moving between tooltips)
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={200} skipDelayDuration={0}>
      {children}
    </RadixTooltip.Provider>
  );
}

/* ─── Motion presets per side ─── */

const slideOffset = 6;

function getMotion(side: "top" | "right" | "bottom" | "left") {
  const axis = side === "top" || side === "bottom" ? "y" : "x";
  const dir = side === "top" || side === "left" ? slideOffset : -slideOffset;
  const initial = { opacity: 0, scale: 0.92, [axis]: dir };
  const animate = { opacity: 1, scale: 1, [axis]: 0 };
  return { initial, animate, exit: initial };
}

const springTransition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
  mass: 0.8,
};

/**
 * User profile tooltip — dark card with avatar, name, divider, role.
 * Stays open while hovering the tooltip content itself (smoothish-sticky).
 */
export function Tooltip({ children, user, side = "top", sideOffset = 6, delayDuration }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const { initial, animate, exit } = getMotion(side);

  return (
    <RadixTooltip.Root open={open} onOpenChange={setOpen} delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

      <AnimatePresence>
        {open && (
          <RadixTooltip.Portal forceMount>
            <RadixTooltip.Content
              side={side}
              sideOffset={sideOffset}
              /* Radix keeps the tooltip open while the pointer is over it */
              asChild
            >
              <motion.div
                initial={initial}
                animate={animate}
                exit={exit}
                transition={springTransition}
                className="z-50 flex flex-col rounded-[4px] border border-[#141414] bg-gradient-to-b from-[#434343] to-[#232323] pb-px shadow-[0px_0.6px_0px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.18),inset_0px_1px_0px_rgba(255,255,255,0.18)]"
              >
                {/* Name row */}
                <div className="flex items-center gap-1 pl-1 pr-2 pt-px">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="size-3.5 shrink-0 rounded-[4.2px] object-cover" />
                  ) : (
                    <div className="flex size-3.5 shrink-0 items-center justify-center rounded-[4.2px] bg-[#d9d9d9]">
                      {user.avatarFallback && (
                        <span className="text-[7px] font-medium leading-none text-[#232323]">{user.avatarFallback}</span>
                      )}
                    </div>
                  )}
                  <span className="text-xs leading-5 tracking-[-0.019px] text-white">{user.name}</span>
                </div>

                {user.role ? (
                  <>
                    {/* Divider */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    {/* Role row */}
                    <div className="pl-1 pr-2 pb-px">
                      <span className="text-xs font-light leading-5 tracking-[-0.019px] text-white/70">{user.role}</span>
                    </div>
                  </>
                ) : null}
              </motion.div>
            </RadixTooltip.Content>
          </RadixTooltip.Portal>
        )}
      </AnimatePresence>
    </RadixTooltip.Root>
  );
}

/* ─── Simple text tooltip (for general use) ─── */

interface SimpleTooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  delayDuration?: number;
}

export function SimpleTooltip({ children, content, side = "top", sideOffset = 6, delayDuration }: SimpleTooltipProps) {
  const [open, setOpen] = useState(false);
  const { initial, animate, exit } = getMotion(side);

  return (
    <RadixTooltip.Root open={open} onOpenChange={setOpen} delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

      <AnimatePresence>
        {open && (
          <RadixTooltip.Portal forceMount>
            <RadixTooltip.Content side={side} sideOffset={sideOffset} asChild>
              <motion.div
                initial={initial}
                animate={animate}
                exit={exit}
                transition={springTransition}
                className="z-50 rounded-md border border-[#141414] bg-gradient-to-b from-[#434343] to-[#232323] px-2.5 py-1 shadow-[0px_0.6px_0px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.18),inset_0px_1px_0px_rgba(255,255,255,0.18)]"
              >
                <span className="flex items-center gap-1.5 text-xs leading-5 tracking-[-0.019px] text-white">{content}</span>
              </motion.div>
            </RadixTooltip.Content>
          </RadixTooltip.Portal>
        )}
      </AnimatePresence>
    </RadixTooltip.Root>
  );
}
