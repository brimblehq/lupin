import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { WarningModal } from "@/components/shared/warning-modal";
import { DashInput } from "@/components/shared/dash-input";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useStepUpTwoFactor } from "@/hooks/use-step-up-two-factor";
import { getTwoFactorStatusServerFn } from "@/server/auth/actions";
import { deleteBucketServerFn } from "@/server/storage/actions";
import type { BucketRecord } from "@/backend/storage";

interface DeleteBucketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: BucketRecord;
  bucketId: string;
  workspace?: string;
  onDeleted: () => void;
}

export function DeleteBucketModal({ open, onOpenChange, bucket, bucketId, workspace, onDeleted }: DeleteBucketModalProps) {
  const deleteBucket = useServerFn(deleteBucketServerFn);
  const getTwoFactorStatus = useServerFn(getTwoFactorStatusServerFn);
  const { requestStepUp } = useStepUpTwoFactor();

  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const confirmDisabled = typed.trim() !== bucket.name;

  async function handleConfirm() {
    try {
      let twoFactorToken: string | undefined;
      const status = await getTwoFactorStatus();

      if (status?.enabled) {
        const token = await requestStepUp({ action: "delete_bucket", resourceId: bucketId });
        if (!token) {
          return;
        }
        twoFactorToken = token;
      }

      await deleteBucket({
        data: {
          bucketId,
          force: true,
          ...(workspace ? { workspace } : {}),
          ...(twoFactorToken ? { twoFactorToken } : {}),
        },
      });

      toast.success("Bucket deleted");
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete bucket");
      throw error;
    }
  }

  return (
    <WarningModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete bucket "${bucket.name}"?`}
      description="This permanently deletes the bucket and every object inside it. This action cannot be undone."
      confirmLabel="Delete bucket"
      confirmLoadingLabel="Deleting..."
      confirmDisabled={confirmDisabled}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-xs text-dash-text-faded">
          Type <span className="font-medium text-dash-text-strong">{bucket.name}</span> to confirm
        </label>
        <DashInput
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={bucket.name}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    </WarningModal>
  );
}
