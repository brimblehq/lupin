import { cn } from "@brimble/ui";

const variants = {
  blue: {
    bg: "linear-gradient(180deg, #7babf7 0%, #5b8def 30%, #4a7ee0 100%)",
    border: "border-[#4a7ee0]",
  },
  red: {
    bg: "linear-gradient(180deg, #f07070 0%, #e84545 30%, #d63031 100%)",
    border: "border-[#c0392b]",
  },
};

interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  fullWidth?: boolean;
}

export function GlossyButton({
  variant = "blue",
  fullWidth,
  className,
  children,
  ...props
}: GlossyButtonProps) {
  const v = variants[variant];

  return (
    <button
      {...props}
      style={{ background: v.bg, ...props.style }}
      className={cn(
        "flex h-[40px] items-center justify-center rounded-[8px] border px-3.5 text-sm font-medium leading-5 text-white shadow-[0px_1px_2px_rgba(16,24,40,0.1),inset_0px_1px_0px_rgba(255,255,255,0.25)] transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-40",
        v.border,
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}
