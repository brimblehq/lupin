import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { WarningModal } from "@/components/shared/warning-modal";
import { DashInput } from "@/components/shared/dash-input";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { formatRelativeTime } from "@/utils/dashboard";
import { formatBytes } from "@/lib/format";
import { deleteSandboxSnapshotServerFn } from "@/server/sandboxes/actions";
import type { SnapshotResponse } from "@/backend/sandboxes";

interface DeleteSnapshotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SnapshotResponse;
  sourceSandboxName?: string;
  workspace?: string;
  onDeleted: (snapshotId: string) => void;
}

export function DeleteSnapshotModal({ open, onOpenChange, snapshot, sourceSandboxName, workspace, onDeleted }: DeleteSnapshotModalProps) {
  const deleteSnapshot = useServerFn(deleteSandboxSnapshotServerFn);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const confirmDisabled = typed.trim() !== snapshot.name;

  async function handleConfirm() {
    try {
      await deleteSnapshot({
        data: {
          snapshotId: snapshot.id,
          ...(workspace ? { workspace } : {}),
        },
      });

      toast.success("Snapshot deleted");
      onDeleted(snapshot.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete snapshot");
      throw error;
    }
  }

  const size = snapshot.sizeBytes !== null ? formatBytes(snapshot.sizeBytes) : "size unknown";
  const source = sourceSandboxName ?? snapshot.sourceTemplate;
  const created = snapshot.createdAt ? formatRelativeTime(snapshot.createdAt) : "recently";

  return (
    <WarningModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete snapshot "${snapshot.name}"?`}
      description={`${size} · from ${source} · created ${created}. This permanently deletes the snapshot. Sandboxes restored from this snapshot in the future will fail.`}
      confirmLabel="Delete snapshot"
      confirmLoadingLabel="Deleting..."
      confirmDisabled={confirmDisabled}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-xs text-dash-text-faded">
          Type <span className="font-medium text-dash-text-strong">{snapshot.name}</span> to confirm
        </label>
        <DashInput
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={snapshot.name}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    </WarningModal>
  );
}
