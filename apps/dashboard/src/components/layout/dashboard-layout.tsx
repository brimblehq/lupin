import { type ReactNode, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Footer } from "./footer";
import { TooltipProvider } from "../shared/tooltip";
import { Snackbar } from "../shared/snackbar";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullWidth = /^\/projects\/[^/]+/.test(pathname) || /^\/workspace\/new/.test(pathname);

  // Welcome snackbar — shown by default for new users
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // Demo variants — set to true to preview all three
  const showVariantDemo = true;
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-dash-bg">
        <Topbar />
        <AnimatePresence>
          {!welcomeDismissed && (
            <Snackbar
              key="welcome"
              variant="info"
              message="Welcome to Brimble! Get started by creating your first project."
              action={{ label: "Create project", onClick: () => {} }}
              onDismiss={() => setWelcomeDismissed(true)}
            />
          )}
          {showVariantDemo && !warningDismissed && (
            <Snackbar
              key="warning-demo"
              variant="warning"
              message="Your payment method expires soon. Update it to avoid service interruption."
              action={{ label: "Update payment method", onClick: () => {} }}
              onDismiss={() => setWarningDismissed(true)}
            />
          )}
          {showVariantDemo && !errorDismissed && (
            <Snackbar
              key="error-demo"
              variant="error"
              message="We're experiencing degraded performance in the US-East region. Our team is investigating."
              action={{ label: "View status", onClick: () => {} }}
              onDismiss={() => setErrorDismissed(true)}
            />
          )}
        </AnimatePresence>
        {isFullWidth ? (
          <main className="scrollbar-hidden flex flex-1 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-screen-xl flex-1">
              {children}
            </div>
            <Footer />
          </main>
        ) : (
          <div className="mx-auto flex w-full max-w-screen-xl flex-1 overflow-hidden">
            <Sidebar />
            <main className="scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="flex-1 py-8 pl-10">
                {children}
              </div>
              <Footer />
            </main>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
