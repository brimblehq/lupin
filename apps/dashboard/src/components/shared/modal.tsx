import { cn } from "@brimble/ui";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef } from "react";
import { LoadingButtonContent } from "./loading-button-content";
import { useHaptics } from "@/hooks/use-haptics";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Width of the modal. Default: 500px */
  width?: number;
  /** Extra classes merged onto the modal container */
  className?: string;
  /** When false, ESC and click-outside are blocked. Default: true. */
  dismissible?: boolean;
}

export function Modal({ open, onOpenChange, children, width = 500, className, dismissible = true }: ModalProps) {
  const haptics = useHaptics();
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) haptics.soft();
    prevOpen.current = open;
  }, [open, haptics]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !dismissible) return;
        onOpenChange(next);
      }}
    >
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

            <Dialog.Content
              asChild
              onEscapeKeyDown={(e) => {
                if (!dismissible) e.preventDefault();
              }}
              onPointerDownOutside={(e) => {
                if (!dismissible) {
                  e.preventDefault();
                  return;
                }
                const target = e.target as HTMLElement;
                if (target.closest("[data-dropdown-menu]")) {
                  e.preventDefault();
                }
              }}
              onInteractOutside={(e) => {
                if (!dismissible) {
                  e.preventDefault();
                  return;
                }
                const target = e.target as HTMLElement;
                if (target.closest("[data-dropdown-menu]")) {
                  e.preventDefault();
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{
                  duration: 0.25,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ width }}
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-32px)] max-w-[calc(100vw-16px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_3px_rgba(0,0,0,0.06),inset_0px_-3px_2px_rgba(245,245,245,0.3)] sm:max-w-[calc(100vw-32px)] dark:shadow-[0px_2px_3px_rgba(0,0,0,0.2)]",
                  className,
                )}
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

export function ModalHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-t-lg border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-6 py-4">
      <Dialog.Title className="text-base leading-[1.4] tracking-[-0.096px] text-dash-text-strong">{title}</Dialog.Title>
      {description && (
        <Dialog.Description className="text-sm font-light leading-[1.3] text-dash-text-faded">{description}</Dialog.Description>
      )}
    </div>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between border-t-[0.5px] border-dash-border px-4 py-4">{children}</div>;
}

export function ModalCancelButton({ onClick }: { onClick?: () => void }) {
  const haptics = useHaptics();
  return (
    <Dialog.Close asChild>
      <button
        onClick={() => {
          haptics.selection();
          onClick?.();
        }}
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
  loading = false,
  loadingLabel,
  children = "Continue",
}: {
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const haptics = useHaptics();
  return (
    <button
      onClick={() => {
        if (!disabled && !loading) haptics.medium();
        onClick?.();
      }}
      disabled={disabled || loading}
      className="flex items-center rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-4 py-[5px] text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
    >
      <LoadingButtonContent loading={loading} loadingLabel={loadingLabel}>
        {children}
      </LoadingButtonContent>
    </button>
  );
}
