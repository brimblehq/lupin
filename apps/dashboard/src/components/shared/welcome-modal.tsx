import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import { X } from "@phosphor-icons/react";
import { Modal } from "./modal";
import { hasCompletedTour, startProductTour } from "./product-tour";

const STORAGE_KEY = "brimble:welcome-modal-dismissed";

const rotatingTexts = ["Deploy on\nBrimble.", "Scale with\nBrimble.", "Ship on\nBrimble."];

const EASING = [0.16, 1, 0.3, 1] as const;

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % rotatingTexts.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [open]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    if (!hasCompletedTour()) {
      window.setTimeout(() => startProductTour(), 300);
    }
  }, []);

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) dismiss();
      }}
      width={480}
      className="rounded-3xl !border-0 bg-brimble-light-gray !shadow-none outline-none focus:outline-none focus-visible:outline-none dark:bg-brimble-light-gray dark:!shadow-none"
    >
      <Dialog.Title className="sr-only">Welcome to Brimble</Dialog.Title>

      <div className="relative flex flex-col items-start px-10 pb-10 pt-8">
        {/* Close button top-right */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-dash-text-faded transition-colors hover:bg-black/5 hover:text-dash-text-strong dark:hover:bg-white/10"
        >
          <X size={18} weight="bold" />
        </button>

        {/* Logo top-left */}
        <div className="mb-8">
          <img src="/images/brimble.svg" alt="Brimble" className="h-[19px] w-[17px]" />
        </div>

        {/* Baggage illustration — left-aligned with text */}
        <div className="mb-8 h-[208px] w-[296px] max-w-full overflow-hidden brightness-[1.02] mix-blend-multiply dark:invert dark:mix-blend-screen dark:opacity-85">
          <img src="/images/baggage.svg" alt="" className="block h-[252px] w-[296px] max-w-none -translate-x-7 -translate-y-6 opacity-90" />
        </div>

        {/* Rotating heading text */}
        <div className="relative mb-4 h-[120px] w-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.h2
              key={textIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: EASING }}
              className="absolute inset-x-0 whitespace-pre-line text-left font-heading text-[46px] font-semibold italic leading-[1.15] text-dash-text-strong"
            >
              {rotatingTexts[textIndex]}
            </motion.h2>
          </AnimatePresence>
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed text-dash-text-faded">
          Build, deploy, and scale your web applications with ease. Welcome to the platform built for modern developers.
        </p>
      </div>
    </Modal>
  );
}
