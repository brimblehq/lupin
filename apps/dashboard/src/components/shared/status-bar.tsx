import { AnimatePresence, motion } from "motion/react";

interface StatusBarAction {
  label: string;
  onClick: () => void;
}

interface StatusBarProps {
  show: boolean;
  /** Pass rich content via children */
  children: React.ReactNode;
  /** Optional action button on the right */
  action?: StatusBarAction;
}

function OrangeSpinner() {
  return (
    <div className="relative size-8 shrink-0">
      <svg className="size-full animate-spin" viewBox="0 0 32 32" fill="none">
        <circle
          cx="16"
          cy="16"
          r="13"
          stroke="#3a3a3a"
          strokeWidth="3"
        />
        <circle
          cx="16"
          cy="16"
          r="13"
          stroke="#f5a623"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="81.68"
          strokeDashoffset="56"
        />
      </svg>
    </div>
  );
}

export function StatusBar({ show, children, action }: StatusBarProps) {
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
          <div className="flex w-[calc(100vw-32px)] items-center gap-4 rounded-[14px] border border-[#333] bg-[#1a1a1a] py-3 pl-4 pr-3.5 shadow-[0px_8px_24px_rgba(0,0,0,0.32)] sm:w-auto">
            <OrangeSpinner />
            <div className="min-w-0 text-sm leading-5 text-[#999]">
              {children}
            </div>
            {action && (
              <button
                onClick={action.onClick}
                className="ml-2 flex h-[36px] shrink-0 items-center rounded-[8px] border border-[#444] bg-[#2a2a2a] px-4 text-sm font-medium text-[#ccc] transition-colors hover:border-[#555] hover:bg-[#333] hover:text-white"
              >
                {action.label}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
