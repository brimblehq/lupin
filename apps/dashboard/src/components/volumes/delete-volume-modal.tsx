import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { WarningModal } from "@/components/shared/warning-modal";
import { DashInput } from "@/components/shared/dash-input";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { formatRelativeTime } from "@/utils/dashboard";
import { useStepUpTwoFactor } from "@/hooks/use-step-up-two-factor";
import { getTwoFactorStatusServerFn } from "@/server/auth/actions";
import { deleteVolumeServerFn } from "@/server/volumes/actions";
import type { VolumeResponse } from "@/backend/volumes";

interface DeleteVolumeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volume: VolumeResponse;
  workspace?: string;
  onDeleted: (volumeId: string) => void;
}

export function DeleteVolumeModal({ open, onOpenChange, volume, workspace, onDeleted }: DeleteVolumeModalProps) {
  const deleteVolume = useServerFn(deleteVolumeServerFn);
  const getTwoFactorStatus = useServerFn(getTwoFactorStatusServerFn);
  const { requestStepUp } = useStepUpTwoFactor();

  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const confirmDisabled = typed.trim() !== volume.name;

  async function handleConfirm() {
    try {
      let twoFactorToken: string | undefined;
      const status = await getTwoFactorStatus();

      if (status?.enabled) {
        const token = await requestStepUp({ action: "delete_volume", resourceId: volume.id });
        if (!token) {
          return;
        }
        twoFactorToken = token;
      }

      await deleteVolume({
        data: {
          volumeId: volume.id,
          ...(workspace ? { workspace } : {}),
          ...(twoFactorToken ? { twoFactorToken } : {}),
        },
      });

      toast.success("Volume deleted");
      onDeleted(volume.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete volume");
      throw error;
    }
  }

  const regionName = volume.region?.name ?? "—";
  const created = volume.createdAt ? formatRelativeTime(volume.createdAt) : "recently";

  return (
    <WarningModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete volume "${volume.name}"?`}
      description={`${volume.sizeGB} GB · ${regionName} · created ${created}. This permanently destroys the volume and all data stored on it. This action cannot be undone.`}
      confirmLabel="Delete volume"
      confirmLoadingLabel="Deleting..."
      confirmDisabled={confirmDisabled}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-xs text-dash-text-faded">
          Type <span className="font-medium text-dash-text-strong">{volume.name}</span> to confirm
        </label>
        <DashInput
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={volume.name}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    </WarningModal>
  );
}
