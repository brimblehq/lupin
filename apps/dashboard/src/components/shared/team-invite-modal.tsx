import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "./modal";
import { GlossyButton } from "./glossy-button";
import { Avatar } from "./avatar";
import { Spinner } from "./spinner";
import { useProfileDrawer } from "@/contexts/profile-drawer-context";
import { ProfileTab } from "@/types/enums";

const EASE = [0.16, 1, 0.3, 1] as const;

interface TeamInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  userAvatarUrl?: string;
  workspaceName: string;
  workspaceAvatarUrl?: string;
  role?: string;
  onAccept: () => void;
  onDecline: () => void;
  loading?: boolean;
  loadingAction?: "accept" | "decline";
  enforce2FA?: boolean;
  /** null = still loading user's 2FA status; ignore the gate while loading. */
  viewerHas2FA?: boolean | null;
}

export function TeamInviteModal({
  open,
  onOpenChange,
  firstName,
  userAvatarUrl,
  workspaceName,
  workspaceAvatarUrl,
  role,
  onAccept,
  onDecline,
  loading = false,
  loadingAction,
  enforce2FA = false,
  viewerHas2FA = null,
}: TeamInviteModalProps) {
  const profileDrawer = useProfileDrawer();
  const navigate = useNavigate();
  const blockedByTwoFactor = enforce2FA && viewerHas2FA === false;

  const handleSetUp2FA = async () => {
    // Drop the workspace search param so the drawer's personal Security tab is reachable.
    await navigate({ to: "/", search: {} });
    profileDrawer.open(ProfileTab.Security);
    onOpenChange(false);
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} width={420}>
      {/* Confetti banner */}
      <div className="relative h-[100px] w-full overflow-hidden rounded-t-lg">
        <div className="absolute inset-0 mix-blend-multiply dark:invert dark:mix-blend-screen dark:opacity-85">
          <img
            src="/images/confetti.svg"
            alt=""
            className="h-full w-full invert object-cover opacity-80"
            fetchPriority="high"
            decoding="async"
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
          fallbackSeed={firstName}
          alt={firstName}
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
        className="px-6 pb-5"
      >
        <Dialog.Title className="text-base font-medium leading-[1.4] tracking-[-0.096px] text-dash-text-strong">
          Hello {firstName},
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-sm leading-5 text-dash-text-faded">
          You've been invited to <span className="font-medium text-dash-text-strong">{workspaceName}</span> as a workspace{" "}
          {role || "member"}
        </Dialog.Description>
        {blockedByTwoFactor && (
          <div className="mt-3 rounded-[6px] border border-[#f5a623]/30 bg-[#f5a623]/5 px-3 py-2 text-xs leading-[1.5] text-[#a16207] dark:text-[#f5a623]">
            This workspace requires two-factor authentication. Set up 2FA on your account before joining.
          </div>
        )}
        <a
          href="https://docs.brimble.io/team-workspaces"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-dash-text-faded underline decoration-dash-border underline-offset-2 transition-colors hover:text-dash-text-strong"
        >
          Learn more about team workspaces
        </a>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3, ease: EASE }}
        className="flex items-center gap-3 border-t-[0.5px] border-dash-border px-4 py-4"
      >
        <button
          onClick={onDecline}
          disabled={loading}
          className="flex h-[40px] flex-1 items-center justify-center rounded-[8px] border border-dash-border bg-dash-bg text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:pointer-events-none disabled:opacity-40"
        >
          {loading && loadingAction === "decline" ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="text-dash-text-faded" size="size-4" />
              <span>Declining…</span>
            </span>
          ) : (
            "Decline"
          )}
        </button>
        {blockedByTwoFactor ? (
          <GlossyButton
            fullWidth
            onClick={() => {
              void handleSetUp2FA();
            }}
            className="flex-1"
            disabled={loading}
          >
            Set up 2FA
          </GlossyButton>
        ) : (
          <GlossyButton
            fullWidth
            onClick={onAccept}
            className="flex-1"
            disabled={loading}
            loading={loading && loadingAction === "accept"}
            loadingLabel="Accepting…"
          >
            Accept
          </GlossyButton>
        )}
      </motion.div>
    </Modal>
  );
}
