import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useTheme } from "@brimble/config";
import brimbleLogo from "@/assets/icons/brimble-logo.svg";

function StatusDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  );
}

type GroupItem = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
};

function NavGroup({ label, items, active }: { label: string; items: readonly GroupItem[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePos = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  const triggerBase =
    "relative inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 py-1 font-body text-sm font-medium transition-colors duration-150 hover:bg-brimble-air-gray dark:hover:bg-white/10";
  const triggerClass = active
    ? `${triggerBase} text-brimble-black shadow-[var(--shadow-button)]`
    : `${triggerBase} text-brimble-black/50 dark:text-white/50`;

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          role="menu"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-[100] w-[260px] overflow-hidden rounded-xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-1.5 shadow-[var(--shadow-big)] dark:border-white/10 dark:bg-[#1a1c1e]"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {items.map((it) => {
            const linkClass =
              "group flex flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-brimble-air-gray dark:hover:bg-white/10";
            const inner = (
              <>
                <span className="font-body text-sm font-medium text-brimble-black">{it.label}</span>
                {it.description && (
                  <span className="font-body text-[12px] leading-[16px] text-brimble-black/50">{it.description}</span>
                )}
              </>
            );
            return it.external ? (
              <a
                key={it.label}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {inner}
              </a>
            ) : (
              <Link key={it.label} to={it.href} className={linkClass} role="menuitem" onClick={() => setOpen(false)}>
                {inner}
              </Link>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        {label}
        <ChevronDown
          className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          aria-hidden="true"
        />
      </button>

      {mounted && typeof document !== "undefined" && createPortal(menu, document.body)}
    </div>
  );
}

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const linkBase =
    "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 font-body text-sm font-medium transition-colors duration-150 hover:bg-brimble-air-gray dark:hover:bg-white/10";

  return (
    <motion.header
      className="sticky top-0 z-50 w-full bg-brimble-surface/80 backdrop-blur-xl dark:bg-[#222528]/80"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <nav className="mx-auto flex min-w-0 max-w-[1120px] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="shrink-0">
          <img src={brimbleLogo} alt="Brimble" className="size-8 dark:invert" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="scrollbar-hidden flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain pr-1 sm:gap-2">
            {siteConfig.navGroups.map((group, i) => {
              const isActive = group.items.some((it) => !("external" in it && it.external) && pathname === it.href);
              return (
                <motion.div
                  key={group.label}
                  className="shrink-0"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                >
                  <NavGroup label={group.label} items={group.items} active={isActive} />
                </motion.div>
              );
            })}

            {siteConfig.navStandalone.map((link, i) => {
              const isExternal = ("external" in link && link.external) || link.href.startsWith("http");
              const hasStatus = "status" in link && link.status;
              const isActive = !isExternal && pathname === link.href;
              const linkClass = isActive
                ? `${linkBase} text-brimble-black shadow-[var(--shadow-button)]`
                : `${linkBase} text-brimble-black/50 dark:text-white/50 shadow-none`;
              return (
                <motion.div
                  key={link.label}
                  className="shrink-0"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.1 + (siteConfig.navGroups.length + i) * 0.05,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {isExternal ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${linkBase} text-brimble-black/50 shadow-none dark:text-white/50`}
                    >
                      {hasStatus && <StatusDot />}
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.href as "/pricing"} className={linkClass}>
                      {link.label}
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          className="shrink-0"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            onClick={toggleTheme}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[4px] text-brimble-black transition-colors duration-150 hover:bg-brimble-air-gray dark:hover:bg-white/10"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </motion.div>
      </nav>
    </motion.header>
  );
}
