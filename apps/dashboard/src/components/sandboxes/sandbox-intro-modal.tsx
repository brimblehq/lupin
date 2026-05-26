import { useCallback, useEffect, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { Modal, ModalHeader, ModalFooter, ModalContinueButton } from "@/components/shared/modal";

const STORAGE_KEY = "brimble:sandboxes-intro-dismissed";
const DOCS_URL = "https://paper.brimble.io/sandboxes/overview";

const points = [
  {
    iconSrc: "/icons/verified.svg",
    title: "Isolated by default",
    body: "Code runs walled off from your machine and your other workloads — safe for AI-generated or untrusted scripts.",
  },
  {
    iconSrc: "/icons/bolt.svg",
    title: "Ready in seconds",
    body: "Pick a runtime, get a live environment, and start running commands or code right away.",
  },
  {
    iconSrc: "/icons/camera.svg",
    title: "Pause & snapshot",
    body: "Stop the clock when a sandbox is idle, and save its state to restore or clone later.",
  },
] as const;

export function SandboxIntroModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore write failures
    }
  }, []);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
      width={480}
    >
      <ModalHeader
        title="Welcome to Sandboxes"
        description="Isolated, on-demand environments for running code you'd rather not run locally."
      />

      <div className="flex flex-col gap-4 px-6 py-5">
        {points.map((point) => (
          <div key={point.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-dash-border bg-dash-bg-elevated">
              <img src={point.iconSrc} alt="" className="size-4 invert dark:invert-0" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-dash-text-strong">{point.title}</p>
              <p className="text-sm leading-relaxed text-dash-text-faded">{point.body}</p>
            </div>
          </div>
        ))}
      </div>

      <ModalFooter>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[34px] items-center gap-1.5 rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
        >
          Read the docs
          <ArrowSquareOut size={14} />
        </a>
        <ModalContinueButton onClick={dismiss}>Got it</ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}
