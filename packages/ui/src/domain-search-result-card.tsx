import * as React from "react";
import { CheckCircle2 } from "lucide-react";

import { cn } from "./lib/utils";

export interface DomainSearchResult {
  domainName: string;
  available: boolean;
  price: number | null;
  previousPrice?: number | null;
}

export interface DomainSearchResultCardProps {
  result: DomainSearchResult;
  isExactMatch?: boolean;
  onSelect?: () => void;
  className?: string;
  variant?: "dashboard" | "web";
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(amount: number): string {
  return usdFormatter.format(amount);
}

function splitDomain(domainName: string): { base: string; tld: string } {
  const dot = domainName.indexOf(".");
  if (dot === -1) return { base: domainName, tld: "" };
  return { base: domainName.slice(0, dot), tld: domainName.slice(dot + 1) };
}

const variantClasses = {
  dashboard: {
    root: "flex items-center justify-between rounded-[4px] border-[0.5px] border-dash-border px-3.5 py-3 text-left transition-colors",
    hover: "hover:bg-dash-bg-elevated",
    unavailable: "cursor-default opacity-50",
    text: "flex items-center gap-1.5 text-sm text-dash-text-body",
    tld: "font-medium text-dash-text-strong",
    exact: "text-[#4879f8]",
    price: "rounded-full bg-[#34d399]/10 px-2.5 py-0.5 text-xs font-medium text-[#34d399]",
    previousPrice: "text-xs text-dash-text-extra-faded line-through",
    taken: "rounded-full bg-dash-bg-elevated px-2.5 py-0.5 text-xs font-medium text-dash-text-faded",
  },
  web: {
    root: "flex items-center justify-between rounded-[4px] border border-[rgba(152,157,164,0.3)] bg-brimble-surface/90 px-3.5 py-3 text-left transition-colors dark:border-white/10 dark:bg-[#1e2023]",
    hover: "hover:bg-brimble-air-gray dark:hover:bg-[#26292d]",
    unavailable: "cursor-default opacity-65",
    text: "flex items-center gap-1.5 text-sm text-brimble-black/60 dark:text-white/70",
    tld: "font-medium text-brimble-black dark:text-white",
    exact: "text-[#006fff]",
    price: "rounded-full bg-[#34d399]/10 px-2.5 py-0.5 text-xs font-medium text-[#229464] dark:text-[#4ade80]",
    previousPrice: "text-xs text-brimble-black/45 line-through dark:text-white/45",
    taken: "rounded-full bg-brimble-air-gray px-2.5 py-0.5 text-xs font-medium text-brimble-black/55 dark:bg-white/10 dark:text-white/65",
  },
} as const;

export function DomainSearchResultCard({
  result,
  isExactMatch = false,
  onSelect,
  className,
  variant = "web",
}: DomainSearchResultCardProps) {
  const { base, tld } = splitDomain(result.domainName);
  const styles = variantClasses[variant];
  const interactive = typeof onSelect === "function";

  const content = (
    <>
      <span className={styles.text}>
        {base}.<span className={styles.tld}>{tld}</span>
        {isExactMatch && result.available && <CheckCircle2 size={15} className={styles.exact} />}
      </span>
      {result.available ? (
        <span className="flex items-center gap-2">
          {result.previousPrice != null && result.price != null && result.previousPrice > result.price && (
            <span className={styles.previousPrice}>{formatUsd(result.previousPrice)}</span>
          )}
          <span className={styles.price}>{result.price === null ? "Available" : formatUsd(result.price)}</span>
        </span>
      ) : (
        <span className={styles.taken}>Taken</span>
      )}
    </>
  );

  if (!interactive) {
    return <div className={cn(styles.root, !result.available && styles.unavailable, className)}>{content}</div>;
  }

  return (
    <button
      type="button"
      disabled={!result.available}
      onClick={onSelect}
      className={cn(styles.root, result.available ? styles.hover : styles.unavailable, result.available && "cursor-pointer", className)}
    >
      {content}
    </button>
  );
}
