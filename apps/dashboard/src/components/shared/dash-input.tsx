import type { InputHTMLAttributes } from "react";
import { cn } from "@brimble/ui";

export const dashInputBaseClassName =
  "input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

export const dashInputClassName = `w-full ${dashInputBaseClassName}`;

export type DashInputProps = InputHTMLAttributes<HTMLInputElement>;

export function DashInput({ className, ...props }: DashInputProps) {
  return <input {...props} className={cn(dashInputClassName, className)} />;
}
