import * as Dialog from "@radix-ui/react-dialog";
import { Info } from "lucide-react";
import { Modal, ModalFooter, ModalCancelButton, ModalContinueButton } from "@/components/shared/modal";

interface ConfirmServerRuntimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tooltipMessage?: string;
  isFreePlan?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmServerRuntimeModal({
  open,
  onOpenChange,
  tooltipMessage,
  isFreePlan = false,
  loading = false,
  onConfirm,
}: ConfirmServerRuntimeModalProps) {
  const body =
    tooltipMessage?.trim() ||
    `Deploying as a Static Site may fail to build or render incorrectly if your project requires a server runtime.`;

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={460}>
      <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#4879f8]/10">
          <Info className="size-5 text-[#4879f8]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Dialog.Title className="text-base font-medium leading-[1.4] tracking-[-0.096px] text-dash-text-strong">
            Continue as a static deployment?
          </Dialog.Title>
          <Dialog.Description className="text-sm leading-5 text-dash-text-faded">
            {body}
            {isFreePlan && " Upgrade to deploy it as a Web Service."}
          </Dialog.Description>
        </div>
      </div>
      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton onClick={onConfirm} loading={loading} loadingLabel="Deploying...">
          Deploy anyway
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}
