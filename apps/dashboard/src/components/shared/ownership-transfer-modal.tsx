import * as Dialog from "@radix-ui/react-dialog";
import { Modal } from "./modal";
import { GlossyButton } from "./glossy-button";
import { Spinner } from "./spinner";
import { useProfileDrawer } from "@/contexts/profile-drawer-context";
import { ProfileTab } from "@/types/enums";
import { usePaymentMethods } from "@/hooks/use-payments";

interface OwnershipTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  loading?: boolean;
  loadingAction?: "accept" | "deny";
  onAccept: () => void;
  onDeny: () => void;
}

export function OwnershipTransferModal({
  open,
  onOpenChange,
  workspaceName,
  loading = false,
  loadingAction,
  onAccept,
  onDeny,
}: OwnershipTransferModalProps) {
  const profileDrawer = useProfileDrawer();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const hasPaymentMethod = paymentMethods.length > 0;

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={420}>
      <div className="flex flex-col items-center gap-4 px-6 pb-5 pt-6 text-center">
        <img
          src="/icons/icons8-warning-shield.svg"
          alt="Warning"
          className="size-12"
        />
        <div className="flex flex-col gap-1.5">
          <Dialog.Title className="text-base font-medium leading-[1.4] tracking-[-0.096px] text-dash-text-strong">
            Ownership transfer request
          </Dialog.Title>
          <Dialog.Description className="text-sm leading-5 text-dash-text-faded">
            You have a pending request to become the Creator of{" "}
            <span className="font-medium text-dash-text-strong">
              {workspaceName}
            </span>
            . Accept to take ownership, or deny to keep the current owner.
          </Dialog.Description>
          {!hasPaymentMethod && (
            <p className="mt-2 text-xs leading-4 text-[#f5a623]">
              You need to{" "}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  profileDrawer.open(ProfileTab.Billing);
                }}
                className="underline underline-offset-2 hover:opacity-80"
              >
                add a payment method
              </button>
              {" "}before accepting.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t-[0.5px] border-dash-border px-4 py-4 sm:flex-row sm:items-center">
        <button
          onClick={onDeny}
          disabled={loading}
          className="flex h-[40px] flex-1 items-center justify-center rounded-[8px] border border-dash-border bg-dash-bg text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
        >
          {loading && loadingAction === "deny" ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="text-dash-text-faded" size="size-4" />
              <span>Denying...</span>
            </span>
          ) : (
            "Deny"
          )}
        </button>
        <GlossyButton
          fullWidth
          onClick={onAccept}
          className="flex-1"
          disabled={loading || !hasPaymentMethod}
          loading={loading && loadingAction === "accept"}
          loadingLabel="Accepting..."
        >
          Accept
        </GlossyButton>
      </div>
    </Modal>
  );
}
