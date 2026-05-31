import * as RadixTooltip from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StorageObject } from "@/backend/storage";

const HOVER_DELAY_MS = 350;
const PREVIEW_MAX_WIDTH = 240;
const PREVIEW_MAX_HEIGHT = 180;
const SLIDE_OFFSET = 8;
const TOOLTIP_SIDE = "right" as const;

const previewSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 32,
  mass: 0.8,
};

function getPreviewMotion(side: "top" | "right" | "bottom" | "left") {
  const axis = side === "top" || side === "bottom" ? "y" : "x";
  const dir = side === "top" || side === "left" ? SLIDE_OFFSET : -SLIDE_OFFSET;
  const collapsed = { opacity: 0, scale: 0.94, [axis]: dir };
  const settled = { opacity: 1, scale: 1, [axis]: 0 };
  return { initial: collapsed, animate: settled, exit: collapsed };
}

// Theme-independent transparency checker so images with transparent backgrounds
// read consistently in light & dark mode (otherwise the card's bg-dash-bg shows
// through, making dark-content-on-transparent invisible in dark mode).
const checkerSurfaceStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage: `
    linear-gradient(45deg, #ececec 25%, transparent 25%),
    linear-gradient(-45deg, #ececec 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ececec 75%),
    linear-gradient(-45deg, transparent 75%, #ececec 75%)
  `,
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
};

type PreviewKind = "image" | "video";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm"]);

function getFilePreviewKind(name: string): PreviewKind | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  return null;
}

interface FilePreviewTooltipProps {
  obj: StorageObject;
  /** Resolve a (potentially presigned) URL for a private object on first hover. Public objects use obj.public_url directly. */
  resolveUrl: (key: string) => Promise<string>;
  children: ReactNode;
}

export function FilePreviewTooltip({ obj, resolveUrl, children }: FilePreviewTooltipProps) {
  const kind = getFilePreviewKind(obj.key);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(obj.public_url ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(Boolean(obj.public_url));

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    resolveUrl(obj.key)
      .then((next) => setUrl(next))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open, obj.key, resolveUrl]);

  if (!kind) return <>{children}</>;

  return (
    <RadixTooltip.Root open={open} onOpenChange={setOpen} delayDuration={HOVER_DELAY_MS}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

      <AnimatePresence>
        {open && (
          <RadixTooltip.Portal forceMount>
            <RadixTooltip.Content side={TOOLTIP_SIDE} sideOffset={10} collisionPadding={12} asChild>
              <motion.div
                {...getPreviewMotion(TOOLTIP_SIDE)}
                transition={previewSpring}
                style={{ transformOrigin: "left center" }}
                className="z-50 overflow-hidden rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg p-1 shadow-[0px_8px_24px_-12px_rgba(0,0,0,0.22)]"
              >
                <PreviewBody kind={kind} url={url} loading={loading} error={error} altText={obj.key} />
              </motion.div>
            </RadixTooltip.Content>
          </RadixTooltip.Portal>
        )}
      </AnimatePresence>
    </RadixTooltip.Root>
  );
}

interface PreviewBodyProps {
  kind: PreviewKind;
  url: string | null;
  loading: boolean;
  error: boolean;
  altText: string;
}

function PreviewBody({ kind, url, loading, error, altText }: PreviewBodyProps) {
  const placeholderClass = "flex h-[120px] w-[200px] items-center justify-center text-xs text-dash-text-faded";

  if (error) {
    return <div className={placeholderClass}>Preview unavailable</div>;
  }
  if (loading || !url) {
    return <div className={placeholderClass}>Loading preview…</div>;
  }
  return (
    <div className="overflow-hidden rounded-[3px]" style={checkerSurfaceStyle}>
      {kind === "image" ? (
        <img
          src={url}
          alt={altText}
          style={{ maxWidth: PREVIEW_MAX_WIDTH, maxHeight: PREVIEW_MAX_HEIGHT }}
          className="block object-contain"
        />
      ) : (
        <video
          src={`${url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          style={{ maxWidth: PREVIEW_MAX_WIDTH, maxHeight: PREVIEW_MAX_HEIGHT }}
          className="block object-contain"
        />
      )}
    </div>
  );
}
