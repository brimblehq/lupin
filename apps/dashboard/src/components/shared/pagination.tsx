import { cn } from "@brimble/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

/* ─────────────────────────────────────────────
   Shared styles
   ───────────────────────────────────────────── */

const btnBase = cn(
  "inline-flex items-center justify-center rounded-[4px] text-sm font-medium transition-colors",
  "shadow-[0px_1px_2px_rgba(18,18,23,0.05)]",
  "select-none",
);

const btnOutline = cn(
  btnBase,
  "border border-dash-btn-outline-border bg-dash-btn-outline-bg text-dash-btn-outline-text",
  "hover:bg-dash-bg-elevated",
);

const btnDisabled = "pointer-events-none opacity-40";

const tapScale = { scale: 0.95 };

/* ─────────────────────────────────────────────
   Number-based pagination
   ───────────────────────────────────────────── */

interface NumberPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Max page buttons visible before ellipsis (default 5) */
  maxVisible?: number;
}

function getPageRange(
  current: number,
  total: number,
  max: number,
): (number | "ellipsis")[] {
  if (total <= max) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  const siblings = 1;

  // Always include first page
  pages.push(1);

  const leftBound = Math.max(2, current - siblings);
  const rightBound = Math.min(total - 1, current + siblings);

  // Left ellipsis
  if (leftBound > 2) {
    pages.push("ellipsis");
  }

  // Middle range
  for (let i = leftBound; i <= rightBound; i++) {
    pages.push(i);
  }

  // Right ellipsis
  if (rightBound < total - 1) {
    pages.push("ellipsis");
  }

  // Always include last page
  if (total > 1) {
    pages.push(total);
  }

  return pages;
}

export function NumberPagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisible = 5,
}: NumberPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageRange(currentPage, totalPages, maxVisible);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirst}
        aria-label="Previous page"
        className="flex size-8 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>

      {pages.map((page, i) =>
        page === "ellipsis" ? (
          <span
            key={`ellipsis-${i}`}
            className="flex size-8 items-center justify-center text-sm text-dash-text-faded"
            aria-hidden
          >
            &hellip;
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={`Page ${page}`}
            className={`flex size-8 items-center justify-center rounded-[4px] text-sm transition-colors ${
              page === currentPage
                ? "bg-dash-bg-elevated font-medium text-dash-text-strong"
                : "text-dash-text-faded hover:bg-dash-bg-elevated"
            }`}
          >
            {page}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLast}
        aria-label="Next page"
        className="flex size-8 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

/* ─────────────────────────────────────────────
   Cursor-based pagination
   ───────────────────────────────────────────── */

interface CursorPaginationProps {
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNext: () => void;
  onPrev: () => void;
  /** Optional center label, e.g. "Page 3" or "Showing 1–10" */
  label?: string;
  /** Show "Previous" / "Next" text alongside the chevrons (default false) */
  showLabels?: boolean;
}

export function CursorPagination({
  hasNextPage,
  hasPrevPage,
  onNext,
  onPrev,
  label,
  showLabels = false,
}: CursorPaginationProps) {
  if (!hasNextPage && !hasPrevPage) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      {/* Previous */}
      <motion.button
        whileTap={hasPrevPage ? tapScale : undefined}
        onClick={onPrev}
        disabled={!hasPrevPage}
        aria-label="Previous page"
        className={cn(
          btnOutline,
          showLabels ? "h-8 gap-1.5 px-3" : "size-8",
          !hasPrevPage && btnDisabled,
        )}
      >
        <ChevronLeft className="size-4" />
        {showLabels && "Previous"}
      </motion.button>

      {/* Center label */}
      {label && (
        <span className="text-sm text-dash-text-faded">{label}</span>
      )}

      {/* Next */}
      <motion.button
        whileTap={hasNextPage ? tapScale : undefined}
        onClick={onNext}
        disabled={!hasNextPage}
        aria-label="Next page"
        className={cn(
          btnOutline,
          showLabels ? "h-8 gap-1.5 px-3" : "size-8",
          !hasNextPage && btnDisabled,
        )}
      >
        {showLabels && "Next"}
        <ChevronRight className="size-4" />
      </motion.button>
    </nav>
  );
}
