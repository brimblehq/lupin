import { cn } from "@brimble/ui";
import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import {
  ShieldSlash,
  Lock,
  ProhibitInset,
  ClockCountdown,
} from "@phosphor-icons/react";
import { DashButton } from "./dash-button";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";

interface AccessDeniedAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface AccessDeniedProps {
  /** Phosphor icon component. Defaults to ShieldSlash. */
  icon?: ComponentType<IconProps>;
  /** Image src to render instead of an icon. */
  imageSrc?: string;
  /** Heading text. Defaults to "Access Denied". */
  title?: string;
  /** Explanatory body text. */
  description?: string;
  /** Primary CTA. Defaults to "Back to dashboard" linking to /. */
  action?: AccessDeniedAction;
  /** Optional secondary action rendered as a text link. */
  secondaryAction?: AccessDeniedAction;
  className?: string;
}

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function AccessDenied({
  icon: Icon = ShieldSlash,
  imageSrc,
  title = "Access Denied",
  description = "You don't have permission to view this page. Contact the workspace owner if you believe this is a mistake.",
  action = { label: "Back to dashboard", href: "/" },
  secondaryAction,
  className,
}: AccessDeniedProps) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center px-6 py-16",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease }}
        className="flex flex-col items-center text-center"
      >
        {imageSrc ? (
          <img src={imageSrc} alt="" className="mb-6 h-32 w-auto dark:invert dark:mix-blend-screen dark:opacity-85" />
        ) : (
          <div className="mb-5 flex size-12 items-center justify-center rounded-full border border-dash-border-soft bg-dash-bg-elevated">
            <Icon size={20} weight="duotone" className="text-dash-text-faded" />
          </div>
        )}

        <h2 className="mb-2 text-base font-medium tracking-[-0.03px] text-dash-text-strong">
          {title}
        </h2>

        <p className="mb-6 max-w-[360px] text-sm font-light leading-[1.4] text-dash-text-faded">
          {description}
        </p>

        {action.href ? (
          <Link to={action.href as string}>
            <DashButton variant="primary">{action.label}</DashButton>
          </Link>
        ) : action.onClick ? (
          <DashButton variant="primary" onClick={action.onClick}>
            {action.label}
          </DashButton>
        ) : null}

        {secondaryAction &&
          (secondaryAction.href ? (
            <Link
              to={secondaryAction.href as string}
              className="mt-3 text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
            >
              {secondaryAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="mt-3 text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
            >
              {secondaryAction.label}
            </button>
          ))}
      </motion.div>
    </div>
  );
}

/* ─── Presets ─────────────────────────────────────────────── */

export const accessDeniedWorkspace = {
  icon: ShieldSlash,
  title: "Not a Workspace Member",
  description:
    "You don't have access to this workspace. Ask the workspace owner to invite you, or switch to a workspace you belong to.",
  action: { label: "Back to dashboard", href: "/" },
} satisfies Partial<AccessDeniedProps>;

export const accessDeniedProject = {
  icon: Lock,
  title: "Project Access Restricted",
  description:
    "You don't have permission to view this project. Contact the project owner or a workspace admin for access.",
  action: { label: "View all projects", href: "/projects" },
} satisfies Partial<AccessDeniedProps>;

export const accessDeniedDomain = {
  icon: Lock,
  title: "Domain Access Restricted",
  description:
    "You don't have permission to manage this domain. Contact the workspace owner for access.",
  action: { label: "View all domains", href: "/domains" },
} satisfies Partial<AccessDeniedProps>;

export const accessDeniedForbidden = {
  icon: ProhibitInset,
  title: "Action Not Allowed",
  description:
    "Your current role doesn't allow this action. Contact a workspace admin to update your permissions.",
  action: { label: "Back to dashboard", href: "/" },
} satisfies Partial<AccessDeniedProps>;

export const accessDeniedExpired = {
  icon: ClockCountdown,
  title: "Access Expired",
  description:
    "Your access to this resource has expired. Contact the workspace owner to regain access.",
  action: { label: "Back to dashboard", href: "/" },
} satisfies Partial<AccessDeniedProps>;
