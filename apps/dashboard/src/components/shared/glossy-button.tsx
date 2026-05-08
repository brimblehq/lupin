import { cn } from "@brimble/ui";
import { LoadingButtonContent } from "./loading-button-content";
import { useHaptics } from "@/hooks/use-haptics";

const variants = {
  blue: {
    bg: "linear-gradient(180deg, #7babf7 0%, #5b8def 30%, #4a7ee0 100%)",
    border: "border-[#4a7ee0]",
    text: "text-white",
  },
  red: {
    bg: "linear-gradient(180deg, #f07070 0%, #e84545 30%, #d63031 100%)",
    border: "border-[#c0392b]",
    text: "text-white",
  },
  white: {
    bg: "linear-gradient(180deg, #ffffff 0%, #f5f7fb 55%, #eef2f7 100%)",
    border: "border-[#d0d7e2]",
    text: "text-[#111827]",
  },
  black: {
    bg: "linear-gradient(180deg, #3a3f47 0%, #232830 45%, #12161d 100%)",
    border: "border-[#0f141b]",
    text: "text-white",
  },
};

interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: React.ReactNode;
  disableHaptic?: boolean;
}

export function GlossyButton({
  variant = "blue",
  fullWidth,
  loading = false,
  loadingLabel,
  disableHaptic = false,
  className,
  children,
  ...props
}: GlossyButtonProps) {
  const v = variants[variant];
  const haptics = useHaptics();

  return (
    <button
      {...props}
      onClick={(e) => {
        if (!disableHaptic && !props.disabled && !loading) {
          if (variant === "red") {
            haptics.medium();
          } else {
            haptics.light();
          }
        }
        props.onClick?.(e);
      }}
      style={{ background: v.bg, ...props.style }}
      className={cn(
        "flex h-[40px] items-center justify-center rounded-[8px] border px-3.5 text-sm font-medium leading-5 text-white shadow-[0px_1px_2px_rgba(16,24,40,0.1),inset_0px_1px_0px_rgba(255,255,255,0.25)] transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-40",
        v.border,
        v.text,
        fullWidth && "w-full",
        className,
      )}
    >
      <LoadingButtonContent loading={loading} loadingLabel={loadingLabel} spinnerClassName="text-current">
        {children}
      </LoadingButtonContent>
    </button>
  );
}
