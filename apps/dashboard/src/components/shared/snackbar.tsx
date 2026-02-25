import { AnimatePresence, motion } from "motion/react";
import { Info, AlertTriangle, AlertCircle, X } from "lucide-react";
import { cn } from "@brimble/ui";

interface SnackbarProps {
  variant: "info" | "warning" | "error";
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}

const variantConfig = {
  info: {
    color: "#4879f8",
    icon: Info,
  },
  warning: {
    color: "#f5a623",
    icon: AlertTriangle,
  },
  error: {
    color: "#ef2f1f",
    icon: AlertCircle,
  },
} as const;

export function Snackbar({ variant, message, action, onDismiss }: SnackbarProps) {
  const { color, icon: Icon } = variantConfig[variant];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="w-full overflow-hidden"
    >
      <div
        className={cn(
          "flex items-center gap-3 border-b border-dash-border px-4 py-2.5",
          variant === "info" && "bg-[#4879f8]/5 dark:bg-[#4879f8]/15",
          variant === "warning" && "bg-[#f5a623]/5 dark:bg-[#f5a623]/15",
          variant === "error" && "bg-[#ef2f1f]/5 dark:bg-[#ef2f1f]/15",
        )}
      >
        <Icon className="size-4 shrink-0" style={{ color }} />
        <p className="flex-1 text-sm text-dash-text-body dark:text-dash-text-strong">{message}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="shrink-0 text-sm font-medium underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color }}
          >
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 rounded p-0.5 text-dash-text-muted transition-colors hover:text-dash-text-body"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
