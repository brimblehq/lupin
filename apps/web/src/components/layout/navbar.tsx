import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Sun, Moon } from "lucide-react";
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

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.header
      className="sticky top-0 z-50 w-full backdrop-blur-xl bg-brimble-surface/80 dark:bg-[#222528]/80"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <nav className="mx-auto flex max-w-[720px] min-w-0 items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="shrink-0">
          <img src={brimbleLogo} alt="Brimble" className="size-8 dark:invert" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain pr-1 sm:gap-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {siteConfig.navLinks.map((link, i) => {
              const isExternal = link.href.startsWith("http");
              const isActive = !isExternal && pathname === link.href;
              const linkBase =
                "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 font-body text-sm font-medium transition-colors duration-150 hover:bg-brimble-air-gray dark:hover:bg-white/10";
              const linkClass = isActive
                ? `${linkBase} text-brimble-black shadow-[var(--shadow-button)]`
                : `${linkBase} text-brimble-black/50 dark:text-white/50 shadow-none`;

              return (
                <motion.div
                  key={link.label}
                  className="shrink-0"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                >
                  {isExternal ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${linkBase} text-brimble-black/50 dark:text-white/50 shadow-none`}
                    >
                      {link.status && <StatusDot />}
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.href} className={linkClass}>
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
