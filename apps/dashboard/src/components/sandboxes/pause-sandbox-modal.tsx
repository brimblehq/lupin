import { useServerFn } from "@tanstack/react-start";
import { WarningModal } from "@/components/shared/warning-modal";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { pauseSandboxServerFn } from "@/server/sandboxes/actions";

interface PauseSandboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId: string;
  sandboxName: string;
  onPauseRequested: () => void;
}

export function PauseSandboxModal({ open, onOpenChange, sandboxId, sandboxName, onPauseRequested }: PauseSandboxModalProps) {
  const pauseSandbox = useServerFn(pauseSandboxServerFn);

  async function handleConfirm() {
    try {
      await pauseSandbox({ data: { sandboxId } });
      toast.success("Pause requested");
      onPauseRequested();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pause sandbox");
      throw error;
    }
  }

  return (
    <WarningModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Pause sandbox "${sandboxName}"?`}
      description="Stops compute and terminates running processes."
      confirmLabel="Pause sandbox"
      confirmLoadingLabel="Pausing..."
      onConfirm={handleConfirm}
    />
  );
}
