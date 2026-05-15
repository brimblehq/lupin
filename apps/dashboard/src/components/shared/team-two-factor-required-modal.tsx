import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Modal } from "./modal";
import { GlossyButton } from "./glossy-button";
import { Avatar } from "./avatar";
import { useProfileDrawer } from "@/contexts/profile-drawer-context";
import { ProfileTab } from "@/types/enums";

const EASE = [0.16, 1, 0.3, 1] as const;

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface TeamTwoFactorRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  workspaceAvatarUrl?: string;
  userFirstName?: string;
  userAvatarUrl?: string;
}

export function TeamTwoFactorRequiredModal({
  open,
  onOpenChange,
  workspaceName,
  workspaceAvatarUrl,
  userFirstName,
  userAvatarUrl,
}: TeamTwoFactorRequiredModalProps) {
  const profileDrawer = useProfileDrawer();
  const navigate = useNavigate();
  const displayName = capitalize(workspaceName);

  const handleSetUp2FA = async () => {
    await navigate({ to: "/", search: {} });
    profileDrawer.open(ProfileTab.Security);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={420} dismissible={false}>
      {/* Lock badge banner */}
      <div className="relative flex h-[100px] w-full items-center justify-center overflow-hidden rounded-t-lg bg-[#f5a623]/5">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#f5a623]/15">
          <div
            aria-hidden
            className="size-5 bg-[#f5a623] [mask-image:url(/icons/lock.svg)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url(/icons/lock.svg)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-dash-bg to-transparent" />
      </div>

      {/* User → Workspace transition */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 0.3, ease: EASE }}
        className="flex items-center justify-center gap-4 px-6 pb-4"
      >
        <Avatar
          src={userAvatarUrl}
          fallbackSeed={userFirstName || "user"}
          alt={userFirstName || ""}
          className="size-12 shrink-0 rounded-full"
          fetchPriority="high"
          decoding="async"
        />
        <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.5 }}>
          <ArrowRight className="size-4 shrink-0 text-dash-text-faded" />
        </motion.div>
        <Avatar
          src={workspaceAvatarUrl}
          fallbackSeed={workspaceName}
          alt={workspaceName}
          className="size-12 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
          fetchPriority="high"
          decoding="async"
        />
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3, ease: EASE }}
        className="px-6 pb-5 text-center"
      >
        <Dialog.Title className="text-base font-medium leading-[1.4] tracking-[-0.096px] text-dash-text-strong">
          2FA required to access {displayName}
        </Dialog.Title>
        <Dialog.Description className="mt-1.5 text-sm leading-5 text-dash-text-faded">
          {displayName} requires every member to have two-factor authentication enabled. Set up 2FA on your account to continue.
        </Dialog.Description>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3, ease: EASE }}
        className="flex flex-col items-stretch gap-3 border-t-[0.5px] border-dash-border px-4 py-4"
      >
        <GlossyButton
          fullWidth
          onClick={() => {
            void handleSetUp2FA();
          }}
        >
          Set up 2FA
        </GlossyButton>
        <Link
          to="/"
          search={{}}
          className="text-center text-[11px] font-medium text-dash-text-extra-faded transition-colors hover:text-dash-text-faded"
        >
          Switch to personal workspace
        </Link>
      </motion.div>
    </Modal>
  );
}
