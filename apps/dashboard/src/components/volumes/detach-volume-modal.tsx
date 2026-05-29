import { useServerFn } from "@tanstack/react-start";
import { WarningModal } from "@/components/shared/warning-modal";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { detachProjectVolumeServerFn } from "@/server/projects/actions";
import type { VolumeResponse } from "@/backend/volumes";

interface DetachVolumeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volume: VolumeResponse;
  workspace?: string;
  onDetached: (volume: VolumeResponse) => void;
}

export function DetachVolumeModal({ open, onOpenChange, volume, workspace, onDetached }: DetachVolumeModalProps) {
  const detachProjectVolume = useServerFn(detachProjectVolumeServerFn);

  async function handleConfirm() {
    if (!volume.attachedProjectId) return;

    const result = await detachProjectVolume({
      data: {
        projectId: volume.attachedProjectId,
        ...(workspace ? { workspace } : {}),
      },
    });

    toast.success(result.redeployQueued ? "Volume detached. Project redeploy queued." : "Volume detached.");
    onDetached(volume);
  }

  return (
    <WarningModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Detach volume "${volume.name}"?`}
      description="This keeps the volume and its data, but removes it from the attached project. The project will redeploy without this volume and may be briefly unavailable."
      confirmLabel="Detach volume"
      confirmLoadingLabel="Detaching..."
      onConfirm={handleConfirm}
    />
  );
}
