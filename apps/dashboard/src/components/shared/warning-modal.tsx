import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Modal } from "./modal";
import { GlossyButton } from "./glossy-button";
import { TriangleAlert } from "lucide-react";
import { useHaptics } from "@/hooks/use-haptics";

interface WarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  /** When true the confirm button is disabled */
  confirmDisabled?: boolean;
  /** Optional label while confirm is in progress */
  confirmLoadingLabel?: string;
  /** When false, the modal stays open after a successful confirm */
  closeOnConfirm?: boolean;
  /** Optional content rendered between the description and footer (e.g. a confirmation input) */
  children?: React.ReactNode;
}

export function WarningModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  confirmDisabled,
  confirmLoadingLabel,
  closeOnConfirm = true,
  children,
}: WarningModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const haptics = useHaptics();

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={420}>
      <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#ef2f1f]/10">
          <TriangleAlert className="size-5 text-[#ef2f1f]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Dialog.Title className="text-base font-medium leading-[1.4] tracking-[-0.096px] text-dash-text-strong">{title}</Dialog.Title>
          <Dialog.Description className="text-sm leading-5 text-dash-text-faded">{description}</Dialog.Description>
        </div>
        {children && <div className="w-full pt-1">{children}</div>}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t-[0.5px] border-dash-border px-4 py-4 sm:flex-row sm:items-center">
        <Dialog.Close asChild>
          <button
            disabled={submitting}
            className="flex h-[40px] flex-1 items-center justify-center rounded-[8px] border border-dash-border bg-dash-bg text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </Dialog.Close>
        <GlossyButton
          variant="red"
          fullWidth
          disableHaptic
          disabled={confirmDisabled || submitting}
          loading={submitting}
          loadingLabel={confirmLoadingLabel || `${confirmLabel}...`}
          onClick={() => {
            void (async () => {
              try {
                haptics.heavy();
                setSubmitting(true);
                await onConfirm();
                if (closeOnConfirm) {
                  onOpenChange(false);
                }
              } finally {
                setSubmitting(false);
              }
            })();
          }}
          className="flex-1"
        >
          {confirmLabel}
        </GlossyButton>
      </div>
    </Modal>
  );
}
