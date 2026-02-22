import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Width of the modal. Default: 500px */
  width?: number;
}

export function Modal({ open, onOpenChange, children, width = 500 }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{
                  duration: 0.25,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ maxWidth: width }}
                className="fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-clip rounded-lg border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_3px_rgba(0,0,0,0.06),inset_0px_-3px_2px_rgba(245,245,245,0.3)] dark:shadow-[0px_2px_3px_rgba(0,0,0,0.2)]"
              >
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export function ModalHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-6 py-4">
      <Dialog.Title className="text-base leading-[1.4] tracking-[-0.096px] text-dash-text-strong">
        {title}
      </Dialog.Title>
      {description && (
        <Dialog.Description className="text-sm font-light leading-[1.3] text-dash-text-faded">
          {description}
        </Dialog.Description>
      )}
    </div>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-t-[0.5px] border-dash-border px-4 py-4">
      {children}
    </div>
  );
}

export function ModalCancelButton({ onClick }: { onClick?: () => void }) {
  return (
    <Dialog.Close asChild>
      <button
        onClick={onClick}
        className="flex h-[34px] items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
      >
        Cancel
      </button>
    </Dialog.Close>
  );
}

export function ModalContinueButton({
  onClick,
  disabled,
  children = "Continue",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-4 py-[5px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
