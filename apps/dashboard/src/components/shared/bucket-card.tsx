import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MoreVertical } from "lucide-react";
import { getWorkspaceFromSearch } from "@/utils/topbar-navigation";
import type { Bucket } from "./bucket-list";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

export function BucketCard({ bucket, onDelete }: { bucket: Bucket; onDelete?: () => void }) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspace = getWorkspaceFromSearch({ searchStr });
  const fileCount = bucket.objectCount ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <Link to="/buckets/$bucketId" params={{ bucketId: bucket.id }} search={workspace ? { workspace } : {}} className="block">
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex h-[136px] w-[235px] shrink-0 cursor-pointer flex-col overflow-clip rounded-[8px] border-[0.8px] border-dash-border bg-dash-bg"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-3.5 pt-3 pb-2 text-sm tracking-[-0.02px]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_4175_7396)">
                  <rect x="1" y="1" width="14" height="14" rx="7" fill="#D9D9D9"/>
                  <path d="M8 2.00001C6.81331 2.00001 5.65327 2.3519 4.66658 3.01119C3.67988 3.67048 2.91085 4.60755 2.45672 5.70391C2.0026 6.80027 1.88378 8.00666 2.11529 9.17055C2.3468 10.3344 2.91824 11.4035 3.75736 12.2426L8 8.00001V2.00001Z" fill="#969696"/>
                  <path d="M10.8615 9.61995L9.12912 8.96295C8.85789 8.86009 8.72228 8.80866 8.63383 8.87656C8.54538 8.94447 8.56003 9.08876 8.58932 9.37736L8.63567 9.83402C8.68322 10.3025 8.707 10.5367 8.57919 10.5971C8.45138 10.6575 8.28553 10.4904 7.95383 10.1562L5.11362 7.2948L5.11362 7.2948C4.84649 7.02568 4.71292 6.89112 4.75859 6.7707C4.80426 6.65029 4.99346 6.63814 5.37187 6.61383L9.39526 6.35542C9.86514 6.32524 10.1001 6.31015 10.1557 6.4401C10.2113 6.57006 10.0382 6.72961 9.69198 7.04872L9.35447 7.3598C9.14117 7.55639 9.03452 7.65469 9.0557 7.76417C9.07688 7.87364 9.21249 7.92508 9.48372 8.02794L11.2161 8.68494C11.4743 8.78286 11.6042 9.07155 11.5063 9.32975C11.4084 9.58794 11.1197 9.71787 10.8615 9.61995Z" fill="white"/>
                </g>
                <defs>
                  <clipPath id="clip0_4175_7396">
                    <rect width="16" height="16" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
              <span className="min-w-0 shrink font-medium leading-5 text-dash-text-strong">{bucket.name}</span>
            </div>
          </div>
          <span 
            className="line-clamp-1 text-dash-text-faded"
            style={{
              fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif",
              fontWeight: 300,
              fontSize: "14px",
              lineHeight: "22px",
              letterSpacing: "-0.0016em",
            }}
          >
            {fileCount} {fileCount === 1 ? "file" : "files"}
          </span>
        </div>

        <div className="flex h-10 shrink-0 items-center justify-between border-t-[0.5px] border-dash-border px-3.5">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_4175_7396)">
                <rect x="1" y="1" width="14" height="14" rx="7" fill="#D9D9D9"/>
                <path d="M8 2.00001C6.81331 2.00001 5.65327 2.3519 4.66658 3.01119C3.67988 3.67048 2.91085 4.60755 2.45672 5.70391C2.0026 6.80027 1.88378 8.00666 2.11529 9.17055C2.3468 10.3344 2.91824 11.4035 3.75736 12.2426L8 8.00001V2.00001Z" fill="#969696"/>
                <path d="M10.8615 9.61995L9.12912 8.96295C8.85789 8.86009 8.72228 8.80866 8.63383 8.87656C8.54538 8.94447 8.56003 9.08876 8.58932 9.37736L8.63567 9.83402C8.68322 10.3025 8.707 10.5367 8.57919 10.5971C8.45138 10.6575 8.28553 10.4904 7.95383 10.1562L5.11362 7.2948L5.11362 7.2948C4.84649 7.02568 4.71292 6.89112 4.75859 6.7707C4.80426 6.65029 4.99346 6.63814 5.37187 6.61383L9.39526 6.35542C9.86514 6.32524 10.1001 6.31015 10.1557 6.4401C10.2113 6.57006 10.0382 6.72961 9.69198 7.04872L9.35447 7.3598C9.14117 7.55639 9.03452 7.65469 9.0557 7.76417C9.07688 7.87364 9.21249 7.92508 9.48372 8.02794L11.2161 8.68494C11.4743 8.78286 11.6042 9.07155 11.5063 9.32975C11.4084 9.58794 11.1197 9.71787 10.8615 9.61995Z" fill="white"/>
              </g>
              <defs>
                <clipPath id="clip0_4175_7396">
                  <rect width="16" height="16" fill="white"/>
                </clipPath>
              </defs>
            </svg>
            <span className="font-mono text-xs font-bold uppercase leading-[18px] tracking-[-0.02px] text-dash-text-extra-faded opacity-80">
              {bucket.region || "EU"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-2 font-mono text-xs uppercase leading-[18px] tracking-[-0.02px] text-dash-text-extra-faded opacity-80">
              {formatBytes(bucket.storageUsed ?? 0)} / {formatBytes(bucket.quota ?? (1 * 1024 * 1024 * 1024))}
            </span>
            <div 
              ref={menuRef}
              className="relative"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex size-6 items-center justify-center rounded-[4px] text-dash-text-extra-faded transition-colors hover:bg-dash-border hover:text-dash-text-strong"
              >
                <MoreVertical className="size-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-full z-50 mb-1 w-[140px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-[0px_4px_12px_rgba(0,0,0,0.08)]">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete?.();
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors text-[#f05252] hover:bg-dash-border-soft"
                  >
                    Delete bucket
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
