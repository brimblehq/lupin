import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Copy } from "lucide-react";

export const Route = createFileRoute("/projects/$projectId/")({
  component: ProjectDetailPage,
});

const deployments = [
  { url: "audioly-458ghu583.david.brimble.app", date: "Jan 16, 2024" },
  { url: "audioly-458ghu583.david.brimble.app", date: "Jan 16, 2024" },
  { url: "audioly-458ghu583.david.brimble.app", date: "Jan 16, 2024" },
];

const domains = [
  {
    url: "www.audioly.brimble.app",
    team: "Kemdirim's team",
    type: "default domain",
    date: "Jan 13, 2023",
  },
  {
    url: "www.audioly.brimble.app",
    team: "Kemdirim's team",
    type: "Custom domain",
    date: "Jan 13, 2023",
  },
  {
    url: "www.audioly.brimble.app",
    team: "Kemdirim's team",
    type: "Custom domain",
    date: "Jan 13, 2023",
  },
];

function ProjectDetailPage() {
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      {/* Project preview banner */}
      <div className="flex flex-col gap-4">
        <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          {/* Gradient banner */}
          <div className="relative h-[232px] overflow-clip bg-gradient-to-b from-[#ea51bd] to-[#f1558a]">
            {/* Browser window mockup */}
            <div className="absolute inset-x-[3.38%] top-[27px] h-[236px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-white">
              <div className="flex h-[13px] items-center border-b-[0.5px] border-dash-border px-2 py-[6px]">
                <div className="flex gap-1">
                  <span className="size-[4px] rounded-full bg-[#FF5F57]" />
                  <span className="size-[4px] rounded-full bg-[#FEBC2E]" />
                  <span className="size-[4px] rounded-full bg-[#28C840]" />
                </div>
              </div>
              <div className="flex-1" />
            </div>
          </div>
          {/* Project name bar */}
          <div className="flex h-10 items-center justify-between border-t-[0.5px] border-dash-border bg-dash-bg-elevated px-3.5">
            <span className="text-sm leading-5 tracking-[-0.02px] text-dash-text-faded">
              Audioly
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-light leading-[18px] tracking-[-0.02px] text-dash-text-faded opacity-80">
                View live
              </span>
              <ExternalLink className="size-4 text-dash-text-faded" />
            </div>
          </div>
        </div>

        {/* Two cards side by side */}
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Project meta card */}
          <div className="flex flex-1 flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            <div className="flex h-10 items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-sm tracking-[-0.02px]">
              <span className="text-dash-text-strong">Project meta</span>
            </div>
            <div className="flex flex-col">
              <div className="border-b-[0.5px] border-dash-border p-3.5">
                <span className="text-sm font-light leading-[1.3] text-dash-text-faded">
                  Last updated 2 months ago
                </span>
              </div>
              <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                <span className="text-sm font-light leading-[1.3] text-dash-text-faded">
                  Project status
                </span>
                <div className="flex h-5 items-center gap-2 rounded-[4px] bg-[#13d282] px-2">
                  <span className="size-1.5 rounded-full bg-white" />
                  <span className="text-[8px] font-medium tracking-[-0.01px] text-white">
                    READY
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5">
                <span className="text-sm font-light leading-[1.3] text-dash-text-faded">
                  Framework
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-light leading-[1.4] tracking-[-0.28px] text-dash-text-strong">
                    React JS
                  </span>
                  <img
                    src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg"
                    alt="React"
                    className="size-5"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between p-3.5">
                <span className="text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-faded">
                  Repository
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-strong">
                    From <span className="underline">Github</span>
                  </span>
                  <div className="flex size-6 items-center justify-center rounded-full border border-[#3e3e3e] bg-gradient-to-b from-[#666] to-[#1b1b1b] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="white">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deployments card */}
          <div className="flex flex-1 flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            <div className="flex h-10 items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-sm tracking-[-0.02px]">
              <span className="text-dash-text-strong">Deployments</span>
              <span className="text-dash-text-faded">See all</span>
            </div>
            <div className="flex flex-col">
              {deployments.map((dep, i) => (
                <div key={i} className="relative px-3.5 pb-3.5 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-full w-[17px] shrink-0 items-center">
                      {i > 0 && (
                        <div className="absolute -top-3 left-[7.5px] h-3 w-px bg-dash-border" />
                      )}
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="shrink-0"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="2"
                          stroke="#353535"
                          strokeWidth="1.5"
                          fill="none"
                        />
                        <path
                          d="M10 8h4"
                          stroke="#353535"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M2 8h4"
                          stroke="#353535"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      {i < deployments.length - 1 && (
                        <div className="absolute -bottom-3.5 left-[7.5px] h-3.5 w-px bg-dash-border" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-light leading-[1.4] tracking-[-0.28px] text-dash-text-strong">
                        {dep.url}
                      </span>
                      <span className="text-sm font-light leading-[1.4] tracking-[-0.28px] text-dash-text-faded">
                        {dep.date}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Project domains section */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium leading-5 tracking-[-0.03px] text-dash-text-body">
            Project domains
          </h2>
          <p className="max-w-[560px] text-sm font-light leading-[1.3] text-dash-text-faded">
            Manage all your domains on this project. You get a default
            ".brimble.com" domain with each project you deploy.
          </p>
        </div>
        <hr className="border-dash-border" />
      </div>

      {/* Domain rows */}
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {domains.map((domain, i) => (
          <div
            key={i}
            className="flex h-[68px] items-center justify-between border-b-[0.5px] border-dash-border bg-white px-3.5 last:border-b-0 dark:bg-dash-bg"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-light leading-5 tracking-[-0.02px] text-dash-text-strong">
              {domain.url}
            </span>
            <div className="flex flex-col leading-5 tracking-[-0.02px]">
              <span className="text-sm text-dash-text-strong">
                {domain.team}
              </span>
              <span className="text-sm font-light text-dash-text-faded">
                {domain.type} - {domain.date}
              </span>
            </div>
            <button className="flex h-[34px] items-center gap-2 rounded-[4px] border border-dash-border px-2 transition-colors hover:bg-dash-bg-elevated dark:border-dash-border">
              <Copy className="size-4 text-dash-text-extra-faded" />
              <span className="text-sm leading-5 tracking-[-0.02px] text-dash-text-extra-faded">
                Copy
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
