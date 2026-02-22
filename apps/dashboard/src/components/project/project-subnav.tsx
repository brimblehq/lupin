import { useState } from "react";
import { cn } from "@brimble/ui";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Pin,
  Share2,
  Globe,
  Settings,
  BarChart3,
  FileText,
  Lock,
  Rocket,
  ScrollText,
} from "lucide-react";
import { WarningModal } from "../shared/warning-modal";

const tabs = [
  { label: "Projects details", slug: "", Icon: Globe },
  { label: "Configuration", slug: "configuration", Icon: Settings },
  { label: "Observability", slug: "observability", Icon: BarChart3 },
  { label: "Domains", slug: "domains", Icon: FileText },
  { label: "Environment", slug: "environment", Icon: Lock },
  { label: "Deployment history", slug: "deployment-history", Icon: Rocket },
  { label: "Logs", slug: "logs", Icon: ScrollText },
];

export function ProjectSubnav({ projectId }: { projectId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  // TODO: replace with real project name from API
  const projectName = projectId;

  return (
    <>
      <div data-subnav className="flex items-center justify-between border-b-[0.5px] border-dash-border">
        {/* Tabs */}
        <div className="scrollbar-hidden flex min-w-0 flex-1 items-start overflow-x-auto">
          {tabs.map((tab) => {
            const tabPath = tab.slug
              ? `/projects/${projectId}/${tab.slug}`
              : `/projects/${projectId}`;
            const isActive = tab.slug
              ? pathname === tabPath || pathname === `${tabPath}/`
              : pathname === `/projects/${projectId}` ||
                pathname === `/projects/${projectId}/`;

            return (
              <Link
                key=<span className="hidden md:inline">{tab.label}</span>
                to={tabPath}
                className={cn(
                  "flex h-14 items-center gap-2 px-2 text-sm tracking-[-0.09px] transition-colors",
                  isActive
                    ? "border-b border-[#3c6ce7] text-dash-text-strong"
                    : "text-dash-text-faded font-light hover:text-dash-text-body"
                )}
              >
                <tab.Icon className="size-4" />
                <span className="hidden md:inline">{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-5 px-3.5">
          <button className="text-sm font-light text-dash-text-body hover:text-dash-text-strong transition-colors">
            <Rocket className="size-4 sm:hidden" /><span className="hidden sm:inline">Redeploy project</span>
          </button>
          <div className="flex items-center gap-4">
            <button className="text-dash-text-faded hover:text-dash-text-strong transition-colors">
              <Pin className="size-4" />
            </button>
            <button className="text-dash-text-faded hover:text-dash-text-strong transition-colors">
              <Share2 className="size-4" />
            </button>
            <button
              onClick={() => {
                setConfirmName("");
                setDeleteOpen(true);
              }}
              className="text-dash-text-faded hover:text-dash-text-strong transition-colors"
            >
              <img src="/icons/folder-trash.svg" alt="Delete" className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <WarningModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this project?"
        description={`This action cannot be undone. All deployments, domains, and environment variables associated with this project will be permanently deleted.`}
        confirmLabel="Delete project"
        cancelLabel="Cancel"
        confirmDisabled={confirmName !== projectName}
        onConfirm={() => {
          // TODO: wire to API
          console.log("Delete project:", projectId);
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          <label className="text-sm leading-5 text-dash-text-faded">
            Type <span className="font-medium text-dash-text-strong">{projectName}</span> to confirm
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={projectName}
            className="w-full rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(225,41,29,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(225,41,29,0.15)]"
          />
        </div>
      </WarningModal>
    </>
  );
}
