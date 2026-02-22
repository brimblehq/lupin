import { AnimatePresence, motion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { GlossyButton } from "./glossy-button";

interface UnsavedChangesBarProps {
  show: boolean;
  onReset: () => void;
  onSave: () => void;
  message?: string;
}

export function UnsavedChangesBar({
  show,
  onReset,
  onSave,
  message = "Unsaved changes",
}: UnsavedChangesBarProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex w-[calc(100vw-32px)] items-center gap-5 rounded-[14px] border border-[#333] bg-[#1a1a1a] py-3 pl-5 pr-3.5 shadow-[0px_8px_24px_rgba(0,0,0,0.32)] sm:w-auto">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 shrink-0 text-[#f5a623]" />
              <span className="whitespace-nowrap text-sm font-medium text-white">
                {message}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={onReset}
                className="flex h-[36px] items-center rounded-[8px] border border-[#444] bg-[#2a2a2a] px-4 text-sm font-medium text-[#ccc] transition-colors hover:border-[#555] hover:bg-[#333] hover:text-white"
              >
                Reset
              </button>
              <GlossyButton onClick={onSave} className="h-[36px]">
                Save
              </GlossyButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
