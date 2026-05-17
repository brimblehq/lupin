import { type ReactNode, useRef, useEffect, useLayoutEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function applyStoredTheme() {
  if (typeof document === "undefined") return;
  try {
    const t = window.localStorage.getItem("theme");
    const legacy = window.localStorage.getItem("brimble-theme");
    let mode: string | null = null;
    if (t === "light" || t === "dark" || t === "system") mode = t;
    else if (legacy === "light" || legacy === "dark") mode = legacy;
    const isSystem = mode === "system" || !mode;
    const isDark = mode === "dark" || (isSystem && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch {
    // ignore
  }
}

/* ─── Brimble Logo (hourglass mark) ─── */

function BrimbleMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.797 5.1c-.432 0-.79.338-.79.77 0 4.132 1.621 7.793 4.115 10.053-2.494 2.292-4.114 5.005-4.114 10.196 0 .438.363.781.8.781h18.383c.438 0 .8-.343.8-.781 0-5.191-1.62-7.904-4.115-10.196 2.494-2.26 4.115-5.921 4.115-10.053 0-.432-.358-.77-.79-.77H6.797Zm2.391 18.661c0 .234.195.416.429.416h12.768c.233 0 .428-.182.428-.416 0-2.699-1.609-5.027-3.932-6.099-.556-.256-.968-.782-.968-1.394 0-.601.398-1.12.938-1.386 2.339-1.151 3.962-3.676 3.962-6.604 0-.253-.21-.45-.463-.45H9.651c-.253 0-.463.197-.463.45 0 2.71 1.39 5.075 3.452 6.325.591.359 1.028.963 1.028 1.655 0 .708-.455 1.322-1.07 1.673-2.038 1.163-3.41 3.338-3.41 5.83Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ─── Right panel: Blue Brimble card inspired by Figma ─── */

// function AuthBrandPanel() {
//   return (
//     <aside className="relative hidden min-h-dvh overflow-hidden bg-[#006fff] lg:flex lg:w-[46%] lg:flex-col">
//       {/* Subtle radial glow */}
//       <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,rgba(255,255,255,0.12),transparent)]" />

//       {/* Content */}
//       <div className="relative flex flex-1 flex-col justify-between px-10 py-10 xl:px-14">
//         {/* Top: logo */}
//         <div className="flex items-center gap-2.5">
//           <BrimbleMark className="size-5 text-white" />
//           <span className="text-sm font-semibold tracking-[-0.2px] text-white">
//             Brimble
//           </span>
//         </div>

//         {/* Center: heading + tagline */}
//         <div className="max-w-[380px]">
//           <h2 className="font-heading text-[52px] font-normal leading-[1.05] tracking-[-1.8px] text-white xl:text-[60px]">
//             Deploy
//             <br />
//             on Brimble.
//           </h2>
//           <p className="mt-5 max-w-[320px] text-sm leading-[1.6] tracking-[-0.1px] text-white/55">
//             Ship your next project in minutes. Connect your repo, configure your build, and go live — infrastructure handled.
//           </p>
//         </div>

//         {/* Bottom: baggage illustration */}
//         <div className="relative flex items-end justify-center">
//           <img
//             src="/images/baggage.svg"
//             alt=""
//             className="w-[72%] max-w-[320px] mix-blend-multiply opacity-90"
//             draggable={false}
//           />
//         </div>
//       </div>
//     </aside>
//   );
// }

/* ─── Layout shell ─── */

export function AuthSplitLayout({
  mode,
  title,
  description,
  children,
  footer,
}: {
  mode: "login" | "signup";
  title: ReactNode;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useTheme();
  useIsomorphicLayoutEffect(() => {
    applyStoredTheme();
  }, []);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-dash-bg px-6 py-10">
      <div className="w-full max-w-[400px]">
        {/* Header row */}
        <div className="mb-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-dash-text-strong">
            <BrimbleMark className="size-6" />
            <span className="text-sm font-semibold tracking-[-0.2px]">Brimble</span>
          </Link>
          <Link
            to={mode === "login" ? "/signup" : "/login"}
            className="rounded-full border border-dash-border bg-dash-bg px-3.5 py-1.5 text-xs font-medium text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </Link>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.5px] text-dash-text-strong sm:text-[32px]">{title}</h1>
          <p className="mt-2.5 text-[13px] leading-[1.5] text-dash-text-faded">{description}</p>
        </div>

        {children}

        {footer && (
          <div className="mt-8 border-t border-dash-border/50 pt-4 text-[11px] leading-[1.6] text-dash-text-extra-faded">{footer}</div>
        )}
      </div>
    </main>
  );
}

/* ─── Shared form components ─── */

export function AuthProviderButton({
  icon,
  label,
  onClick,
  disabled,
  lastUsed,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  lastUsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-dash-border bg-dash-bg text-sm font-medium text-dash-text-strong shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:bg-dash-bg-elevated hover:shadow-[0_2px_4px_rgba(16,24,40,0.08)]"
    >
      {icon}
      <span>{label}</span>
      {lastUsed && (
        <span className="absolute right-3 rounded-full bg-dash-bg-elevated px-1.5 py-0.5 text-[10px] font-normal text-dash-text-faded">
          Last used
        </span>
      )}
    </button>
  );
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative my-6">
      <div className="border-t border-dash-border/60" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-dash-bg px-3 text-[11px] font-medium uppercase tracking-[0.5px] text-dash-text-extra-faded">
        {label}
      </span>
    </div>
  );
}

export function AuthField({
  id,
  label,
  hint,
  error,
  type = "text",
  placeholder,
  value,
  onChange,
  onBlur,
  autoFocus,
  maxLength,
  inputMode,
  className,
  autoComplete,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  maxLength?: number;
  inputMode?: "email" | "numeric" | "text";
  className?: string;
  autoComplete?: string;
}) {
  const hasError = Boolean(error?.trim());

  return (
    <label htmlFor={id} className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-dash-text-strong">{label}</span>
        {hint && <span className="text-[11px] text-dash-text-extra-faded">{hint}</span>}
      </div>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        autoFocus={autoFocus}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={hasError}
        className={`h-11 w-full rounded-[10px] border bg-dash-bg px-3.5 text-sm text-dash-text-strong outline-none transition-shadow placeholder:text-dash-text-extra-faded ${
          hasError
            ? "border-[#ef4444] focus:border-[#ef4444] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
            : "border-dash-border focus:border-[#006fff] focus:shadow-[0_0_0_3px_rgba(0,111,255,0.1)]"
        } ${className ?? ""}`}
      />
      {hasError ? <p className="mt-1.5 text-xs text-[#ef4444]">{error}</p> : null}
    </label>
  );
}

/* ─── OTP Input (6-digit verification code) ─── */

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus,
  error = false,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  error?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
  }, [autoFocus]);

  function handleChange(index: number, char: string) {
    if (!/^[0-9]?$/.test(char)) return;
    const arr = value.split("");
    arr[index] = char;
    const next = arr.join("").slice(0, length);
    onChange(next);
    if (char && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIdx]?.focus();
  }

  return (
    <div className="flex w-full gap-2.5">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`h-12 min-w-0 flex-1 rounded-[10px] border bg-dash-bg text-center text-lg font-semibold text-dash-text-strong outline-none transition-shadow placeholder:text-dash-text-extra-faded ${
            error
              ? "border-[#ef2f1f] focus:border-[#ef2f1f] focus:shadow-[0_0_0_3px_rgba(239,47,31,0.18)]"
              : "border-dash-border focus:border-[#006fff] focus:shadow-[0_0_0_3px_rgba(0,111,255,0.1)]"
          }`}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
