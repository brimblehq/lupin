import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { WarningModal } from "@/components/shared/warning-modal";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { destroySandboxServerFn } from "@/server/sandboxes/actions";

interface DestroySandboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId: string;
  sandboxName: string;
  template: string;
  persistent: boolean;
  isDestroyed?: boolean;
  onDestroyRequested: () => void;
}

export function DestroySandboxModal({
  open,
  onOpenChange,
  sandboxId,
  sandboxName,
  template,
  persistent,
  isDestroyed = false,
  onDestroyRequested,
}: DestroySandboxModalProps) {
  const destroySandbox = useServerFn(destroySandboxServerFn);
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmName("");
    }
  }, [open]);

  async function handleConfirm() {
    try {
      await destroySandbox({ data: { sandboxId } });
      toast.success(`${sandboxName} is being destroyed`);
      onDestroyRequested();
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to destroy sandbox");
      throw error;
    }
  }

  let description: string;
  if (isDestroyed) {
    description = "Permanently removes this sandbox. This can't be undone.";
  } else if (persistent) {
    description = `Shuts down ${template} and kills running processes. Volume data is preserved.`;
  } else {
    description = `Shuts down ${template} and kills running processes. All data will be lost.`;
  }

  const title = isDestroyed ? `Permanently delete "${sandboxName}"?` : `Destroy sandbox "${sandboxName}"?`;
  const confirmLabel = isDestroyed ? "Delete sandbox" : "Destroy sandbox";
  const confirmLoadingLabel = isDestroyed ? "Deleting..." : "Destroying...";

  return (
    <WarningModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      confirmLoadingLabel={confirmLoadingLabel}
      confirmDisabled={confirmName !== sandboxName}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-2 text-left">
        <label className="text-sm leading-5 text-dash-text-faded">
          Type <span className="font-medium text-dash-text-strong">{sandboxName}</span> to confirm
        </label>
        <input
          type="text"
          value={confirmName}
          onChange={(event) => setConfirmName(event.target.value)}
          placeholder={sandboxName}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="input-base input-focus-red w-full px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]"
        />
      </div>
    </WarningModal>
  );
}
