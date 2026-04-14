import { useMemo } from "react";
import { Link } from "@phosphor-icons/react";
import { parseTokens, validateReferences, type ReferenceValidationContext } from "@/utils/env-references";

export function ReferenceCountBadge({ value }: { value: string }) {
  const tokens = useMemo(() => parseTokens(value ?? ""), [value]);
  if (tokens.length === 0) return null;

  const label = tokens.length === 1 ? "1 ref" : `${tokens.length} refs`;
  const tooltip = tokens.map((t) => (t.kind === "shared" ? `shared.${t.name}` : `@${t.projectSlug}.${t.name}`)).join("\n");

  return (
    <span
      title={tooltip}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-dash-syntax/10 px-1.5 py-0.5 text-[10px] font-medium text-dash-syntax"
    >
      <Link size={10} weight="bold" />
      {label}
    </span>
  );
}

export function ReferenceWarnings({ value, context }: { value: string; context: ReferenceValidationContext }) {
  const warnings = useMemo(() => validateReferences(value, context), [value, context]);
  if (warnings.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-1 px-px">
      {warnings.map((w, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-[#b37a10] dark:text-[#f59e0b]">
          <span className="font-mono">{w.token}</span>
          <span>— {w.message}</span>
        </li>
      ))}
    </ul>
  );
}
