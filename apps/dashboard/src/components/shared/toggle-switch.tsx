import { motion } from "motion/react";
import { cn } from "@brimble/ui";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}

const sizes = {
  sm: { track: "w-[28px] h-[16px]", thumb: "size-[12px]", translate: 12 },
  default: { track: "w-[36px] h-[20px]", thumb: "size-[16px]", translate: 16 },
};

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = "default",
}: ToggleSwitchProps) {
  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors",
        s.track,
        checked ? "bg-[#4879f8]" : "bg-dash-border",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <motion.span
        animate={{ x: checked ? s.translate : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]",
          s.thumb,
          "ml-[2px]",
        )}
      />
    </button>
  );
}
