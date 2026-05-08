import { cn } from "@brimble/ui";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useHaptics } from "@/hooks/use-haptics";

interface DashButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline" | "primary";
  size?: "sm" | "default";
  children: ReactNode;
}

const base = "inline-flex items-center gap-1 font-medium transition-colors shadow-[0px_1px_2px_rgba(18,18,23,0.05)]";

const variants = {
  outline: "rounded-lg border border-dash-btn-outline-border bg-dash-btn-outline-bg text-dash-btn-outline-text hover:bg-dash-bg-elevated",
  primary: "rounded-lg border border-[#3964d5] bg-[#4879f8] text-white hover:bg-[#3a6ae6]",
};

const sizes = {
  sm: "px-3 py-1 text-xs",
  default: "px-3 py-[7px] text-sm",
};

export function DashButton({ variant = "outline", size = "default", className, children, ...props }: DashButtonProps) {
  const haptics = useHaptics();

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
      onClick={(e) => {
        if (!props.disabled) haptics.selection();
        props.onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
