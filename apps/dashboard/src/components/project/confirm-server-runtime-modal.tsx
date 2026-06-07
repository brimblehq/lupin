import * as Dialog from "@radix-ui/react-dialog";
import { Modal, ModalFooter, ModalCancelButton, ModalContinueButton } from "@/components/shared/modal";
import { useDeveloperTrial } from "@/hooks/use-developer-trial";

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
  const { start: startTrial, loading: startingTrial } = useDeveloperTrial({ onSuccess: () => onOpenChange(false) });
  const body =
    tooltipMessage?.trim() ||
    `This project may need a server runtime — a static deploy could fail or render incorrectly.`;

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={460}>
      <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#4879f8]">
          <img src="/icons/info.svg" alt="" className="size-6" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Dialog.Title className="text-base font-medium leading-[1.4] tracking-[-0.096px] text-dash-text-strong">
            Continue as a static deployment?
          </Dialog.Title>
          <Dialog.Description className="text-sm leading-5 text-dash-text-faded">
            {body}
            {isFreePlan && " Start a free 14-day Developer trial to deploy it as a Web Service."}
          </Dialog.Description>
        </div>
      </div>
      <ModalFooter>
        <ModalCancelButton />
        {isFreePlan ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onConfirm()}
              disabled={loading || startingTrial}
              className="flex h-[34px] items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
            >
              Deploy anyway
            </button>
            <ModalContinueButton
              onClick={() => void startTrial()}
              loading={startingTrial}
              disabled={loading}
              loadingLabel="Starting..."
            >
              Start free trial
            </ModalContinueButton>
          </div>
        ) : (
          <ModalContinueButton onClick={onConfirm} loading={loading} loadingLabel="Deploying...">
            Deploy anyway
          </ModalContinueButton>
        )}
      </ModalFooter>
    </Modal>
  );
}
