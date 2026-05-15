/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface ScoutBarContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  open: () => void;
  close: () => void;
}

const ScoutBarContext = createContext<ScoutBarContextValue | null>(null);

export function ScoutBarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return <ScoutBarContext.Provider value={{ isOpen, setIsOpen, open, close }}>{children}</ScoutBarContext.Provider>;
}

export function useScoutBar() {
  const ctx = useContext(ScoutBarContext);
  if (!ctx) throw new Error("useScoutBar must be used within ScoutBarProvider");
  return ctx;
}
