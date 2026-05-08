import { Toaster } from "sonner";
import { useTheme } from "../../hooks/use-theme";

export function DashToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-center"
      theme={theme}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border-[0.5px] !border-[var(--dash-border)] !bg-[var(--dash-bg)] !font-[var(--font-family-body)] !shadow-[0px_2px_3px_rgba(0,0,0,0.06),inset_0px_-3px_2px_rgba(245,245,245,0.3)] dark:!shadow-[0px_2px_3px_rgba(0,0,0,0.2)]",
          title: "!text-[var(--dash-text-strong)] !text-sm !font-normal",
          description: "!text-[var(--dash-text-body)] !text-[13px] !font-light",
          actionButton:
            "!rounded-lg !border !border-[#232931] !bg-gradient-to-b !from-[#545459] !via-[#45454b] !to-[#2d2d32] !px-3 !py-[3px] !text-[13px] !font-medium !text-white !shadow-[0px_1px_2px_rgba(18,18,23,0.05)]",
          cancelButton:
            "!rounded-lg !border !border-[var(--dash-border)] !bg-[var(--dash-bg)] !px-3 !py-[3px] !text-[13px] !font-medium !text-[var(--dash-text-strong)] !shadow-[0px_1px_2px_rgba(18,18,23,0.05)]",
          closeButton: "!border-[var(--dash-border)] !bg-[var(--dash-bg)] !text-[var(--dash-text-faded)]",
          success: "!border-[var(--dash-border)]",
          error: "!border-[var(--dash-border)]",
          info: "!border-[var(--dash-border)]",
          warning: "!border-[var(--dash-border)]",
          icon: "!mr-0.5",
        },
      }}
      icons={{
        success: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#34d399" strokeWidth="1.5" />
            <path d="M5 8.25L7.15 10.25L11 5.75" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        error: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#ef2f1f" strokeWidth="1.5" />
            <path d="M8 5v3.5" stroke="#ef2f1f" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.75" fill="#ef2f1f" />
          </svg>
        ),
        warning: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M7.134 2.5a1 1 0 0 1 1.732 0l5.196 9a1 1 0 0 1-.866 1.5H2.804a1 1 0 0 1-.866-1.5l5.196-9Z"
              stroke="#f5a623"
              strokeWidth="1.5"
            />
            <path d="M8 6v2.5" stroke="#f5a623" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="10.75" r="0.75" fill="#f5a623" />
          </svg>
        ),
        info: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#4879f8" strokeWidth="1.5" />
            <path d="M8 7.5V11" stroke="#4879f8" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="5.5" r="0.75" fill="#4879f8" />
          </svg>
        ),
      }}
    />
  );
}
