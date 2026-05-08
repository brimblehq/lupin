/**
 * Per-route pending skeletons. Each one mirrors the layout of the tab/page
 * it stands in for so the visual weight stays put while the loader resolves.
 *
 * Default export `RoutePending` is a generic shell used as the router-wide
 * fallback for routes that don't declare their own pendingComponent.
 */
import { useRouterState } from "@tanstack/react-router";

const PULSE_BG_STRONG = "bg-dash-border-soft/70";
const PULSE_BG_MEDIUM = "bg-dash-border-soft/50";
const PULSE_BG_WEAK = "bg-dash-border-soft/30";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded ${PULSE_BG_MEDIUM} ${className}`} />;
}

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40 ${className}`} />;
}

function TabHeaderSkeleton({ subtitleLines = 1 }: { subtitleLines?: number }) {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className={`h-5 w-48 rounded ${PULSE_BG_STRONG}`} />
      {Array.from({ length: subtitleLines }).map((_, i) => (
        <div key={i} className={`h-3.5 w-full max-w-[480px] rounded ${PULSE_BG_MEDIUM}`} />
      ))}
    </div>
  );
}

function TableRowSkeleton({ count = 5, height = "h-[52px]", padded = "px-4" }: { count?: number; height?: string; padded?: string }) {
  return (
    <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex ${height} items-center justify-between border-b-[0.5px] border-dash-border ${padded} last:border-b-0`}
        >
          <div className={`h-3 w-32 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          <div className={`h-3 w-20 rounded ${PULSE_BG_WEAK} animate-pulse`} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Generic fallback (also exported as default)
   ───────────────────────────────────────────── */

export function RoutePending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 py-8" aria-hidden="true">
      <TabHeaderSkeleton />
      <hr className="border-dash-border" />
      <TableRowSkeleton count={6} />
    </div>
  );
}

export function DefaultRoutePending() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname || state.resolvedLocation?.pathname || "/",
  });

  if (/^\/projects\/new(?:\/|$)/.test(pathname)) {
    return <NewProjectPending />;
  }

  if (/^\/projects\/[^/]+(?:\/|$)/.test(pathname) && !/^\/projects\/new(?:\/|$)/.test(pathname)) {
    return <ProjectOverviewPending />;
  }

  if (pathname === "/" || pathname.startsWith("/workspace")) {
    return <HomePending />;
  }

  if (pathname.startsWith("/scaling")) {
    return <ScalingPending />;
  }

  return <RoutePending />;
}

/* ─────────────────────────────────────────────
   / (workspace home)

   Mirrors routes/index.tsx:
   1. WelcomeSection: h1 "Welcome <name>," + subtitle paragraph
   2. StatsRow: single rounded card, 3 columns on lg (Bandwidth | Deployment minutes | Total projects), each 30px header
   3. hr
   4. DeployedProjects: PageHeader + 3-col grid of 168px ProjectCards
   5. hr
   6. ConnectedDomains: flex card with left text+button, right big number
   7. hr
   8. FeaturedIntegrations: section header + Browse button + 3-col grid of addon cards
   ───────────────────────────────────────────── */

export function HomePending() {
  return (
    <div className="max-w-[1000px]" aria-hidden="true">
      {/* WelcomeSection */}
      <div className="mb-6">
        <div className={`mb-2 h-8 w-64 rounded ${PULSE_BG_STRONG} animate-pulse`} />
        <div className={`h-3.5 w-full max-w-[480px] rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
      </div>

      {/* StatsRow — single rounded card, 3 columns on lg, h-[160px] */}
      <div className="mb-8 flex flex-col overflow-hidden rounded border-[0.5px] border-dash-border lg:h-[160px] lg:flex-row">
        {/* Bandwidth (36%) */}
        <div className="flex w-full shrink-0 flex-col border-b-[0.5px] border-dash-border lg:w-[36%] lg:border-b-0 lg:border-r-[0.5px]">
          <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated/60 px-2">
            <div className={`h-2.5 w-44 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          </div>
          <div className="px-2 pb-3 pt-2">
            <div className={`h-2.5 w-20 rounded ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
          <div className="mt-auto h-[65px] w-full bg-gradient-to-t from-dash-border-soft/30 to-transparent" />
        </div>

        {/* Deployment minutes (34%) */}
        <div className="flex w-full shrink-0 flex-col border-b-[0.5px] border-dash-border lg:w-[34%] lg:border-b-0">
          <div className="flex h-[30px] items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated/60 px-2">
            <div className={`h-2.5 w-32 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
            <div className={`h-2.5 w-16 rounded ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
          <div className="flex flex-1 flex-col justify-between gap-1 px-2 py-3.5 lg:gap-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <div className={`h-3 w-32 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
                  <div className={`h-3 w-12 rounded ${PULSE_BG_WEAK} animate-pulse`} />
                </div>
                {i < 2 && <hr className="mt-2 border-dash-border lg:mt-1.5" />}
              </div>
            ))}
          </div>
        </div>

        {/* Total projects */}
        <div className="flex flex-1 flex-col border-t-[0.5px] border-dash-border lg:border-l-[0.5px] lg:border-t-0">
          <div className="flex h-[30px] items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated/60 px-2.5">
            <div className={`h-2.5 w-44 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 lg:py-0">
            <div className={`h-7 w-16 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
            <div className={`h-7 w-32 rounded-[4px] ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
        </div>
      </div>

      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />

      {/* DeployedProjects */}
      <div className="mb-8">
        <div className="mb-8 flex items-center gap-4">
          <div>
            <div className={`mb-2 h-4 w-40 rounded ${PULSE_BG_STRONG} animate-pulse`} />
            <div className={`h-3.5 w-full max-w-[420px] rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-h-[168px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30 animate-pulse" />
          ))}
        </div>
      </div>

      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />

      {/* ConnectedDomains */}
      <div className="mb-8 flex rounded-[4px] border-[0.5px] border-dash-border py-2">
        <div className="flex flex-1 flex-col gap-3.5 px-3.5 py-3.5">
          <div className="flex flex-col gap-2">
            <div className={`h-4 w-44 rounded ${PULSE_BG_STRONG} animate-pulse`} />
            <div className={`h-3.5 w-full max-w-[400px] rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          </div>
          <div className={`h-9 w-44 rounded-[6px] ${PULSE_BG_MEDIUM} animate-pulse`} />
        </div>
        <div className="hidden h-[122px] w-[169px] shrink-0 flex-col items-center justify-center border-l-[0.5px] border-dash-border pl-3.5 pr-2 sm:flex">
          <div className="flex flex-col items-start gap-2">
            <div className={`h-12 w-16 rounded ${PULSE_BG_STRONG} animate-pulse`} />
            <div className={`h-3 w-28 rounded ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
        </div>
      </div>

      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />

      {/* FeaturedIntegrations */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className={`mb-2 h-5 w-24 rounded ${PULSE_BG_STRONG} animate-pulse`} />
            <div className={`h-3.5 w-full max-w-[400px] rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          </div>
          <div className={`h-8 w-24 rounded-[6px] ${PULSE_BG_MEDIUM} animate-pulse`} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="min-h-[200px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/$projectId (overview)

   Mirrors the actual layout:
   1. Preview banner (gradient bg + browser-window mockup + name bar)
   2. Two side-by-side cards: Project meta (rows) + Deployments (timeline rows)
   3. "Project domains" section header + hr
   4. Domains table (68px rows: name | type pill | date | copy button)
   ───────────────────────────────────────────── */

export function ProjectOverviewPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 py-8" aria-hidden="true">
      {/* Preview banner */}
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        <div className="relative h-[232px] overflow-clip bg-gradient-to-b from-dash-border-soft/60 to-dash-border-soft/30">
          <div className="absolute inset-x-[3.38%] top-[27px] h-[236px] overflow-clip rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40">
            <div className="flex h-[13px] items-center border-b-[0.5px] border-dash-border px-2">
              <div className="flex gap-1">
                <span className={`size-[4px] rounded-full ${PULSE_BG_WEAK}`} />
                <span className={`size-[4px] rounded-full ${PULSE_BG_WEAK}`} />
                <span className={`size-[4px] rounded-full ${PULSE_BG_WEAK}`} />
              </div>
            </div>
            <div className="h-[222px] w-full animate-pulse bg-dash-bg-elevated/60" />
          </div>
        </div>
        <div className="flex h-10 items-center justify-between border-t-[0.5px] border-dash-border bg-dash-bg-elevated/60 px-3.5">
          <div className={`h-3 w-32 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          <div className={`h-3 w-16 rounded ${PULSE_BG_WEAK} animate-pulse`} />
        </div>
      </div>

      {/* Meta + Deployments cards (md:flex-row) */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Project meta card */}
        <div className="flex flex-1 flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          <div className="flex h-10 items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated/60 px-3">
            <div className={`h-3 w-24 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          </div>
          {/* First row is single-column "Last updated …" */}
          <div className="border-b-[0.5px] border-dash-border p-3.5">
            <div className={`h-3 w-44 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b-[0.5px] border-dash-border p-3.5 last:border-b-0">
              <div className={`h-3 w-24 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
              <div className={`h-3 w-20 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            </div>
          ))}
        </div>

        {/* Deployments card */}
        <div className="flex flex-1 flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          <div className="flex h-10 items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated/60 px-3">
            <div className={`h-3 w-24 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
            <div className={`h-3 w-12 rounded ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="relative px-3.5 pb-3.5 pt-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-full w-[17px] shrink-0 items-center">
                    {i > 0 && <div className="absolute -top-3 left-[7.5px] h-3 w-px bg-dash-border" />}
                    <div className={`size-4 rounded-full ${PULSE_BG_WEAK}`} />
                    {i < 3 && <div className="absolute -bottom-3.5 left-[7.5px] h-3.5 w-px bg-dash-border" />}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className={`h-3 w-44 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
                    <div className={`h-3 w-28 rounded ${PULSE_BG_WEAK} animate-pulse`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project domains section */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className={`h-5 w-40 rounded ${PULSE_BG_STRONG} animate-pulse`} />
          <div className={`h-3.5 w-full max-w-[480px] rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
        </div>
        <hr className="border-dash-border" />
      </div>

      {/* Domain rows table */}
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex h-[68px] items-center border-b-[0.5px] border-dash-border px-3.5 last:border-b-0">
            <div className={`h-3 w-[40%] max-w-[280px] rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className={`size-[6px] rounded-full ${PULSE_BG_MEDIUM} animate-pulse`} />
                <div className={`h-3 w-14 rounded ${PULSE_BG_WEAK} animate-pulse`} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className={`h-3 w-20 rounded ${PULSE_BG_WEAK} animate-pulse`} />
                <div className={`h-3 w-16 rounded ${PULSE_BG_WEAK} animate-pulse`} />
              </div>
              <div className={`size-[34px] rounded-[4px] border border-dash-border ${PULSE_BG_WEAK}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/$projectId/configuration
   Header + sidebar nav + content panel
   ───────────────────────────────────────────── */

export function ProjectConfigurationPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-4 py-8 sm:px-0" aria-hidden="true">
      <TabHeaderSkeleton />
      <hr className="border-dash-border" />
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
        <div className="flex w-full flex-col gap-1.5 lg:w-[180px] lg:shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-9 w-full animate-pulse rounded-[4px] ${PULSE_BG_WEAK}`} />
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
          <div className="flex flex-col gap-5 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className={`h-3.5 w-32 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
                <div className="h-10 w-full animate-pulse rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40" />
              </div>
            ))}
            <div className="flex justify-end">
              <div className={`h-9 w-32 rounded-[4px] ${PULSE_BG_MEDIUM} animate-pulse`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/$projectId/deployment-history
   Header + filter bar + deployment rows
   ───────────────────────────────────────────── */

export function DeploymentHistoryPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 py-8" aria-hidden="true">
      <TabHeaderSkeleton />
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="h-9 flex-1 animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30 sm:min-w-[280px]" />
        <div className="h-9 w-[180px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-9 w-[140px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-9 w-[120px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
      </div>
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex h-[64px] items-center gap-3 border-b-[0.5px] border-dash-border px-4 last:border-b-0">
            <div className={`size-2 rounded-full ${PULSE_BG_MEDIUM} animate-pulse`} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className={`h-3 w-48 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
              <div className={`h-2.5 w-32 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            </div>
            <div className={`h-3 w-20 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            <div className={`h-3 w-16 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            <div className={`size-4 rounded ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/$projectId/environment
   Header + search + raw editor + env var rows
   ───────────────────────────────────────────── */

export function EnvironmentPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 py-8" aria-hidden="true">
      <TabHeaderSkeleton />
      <hr className="border-dash-border" />
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        <div className="flex items-center justify-between border-b-[0.5px] border-dash-border px-3.5 py-3.5">
          <div className="h-9 max-w-[280px] flex-1 animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
          <div className={`h-9 w-32 rounded-[4px] ${PULSE_BG_MEDIUM} animate-pulse`} />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex h-[56px] items-center gap-3 border-b-[0.5px] border-dash-border px-4 last:border-b-0">
            <div className={`h-3 w-32 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
            <div className={`h-3 flex-1 max-w-[280px] rounded ${PULSE_BG_WEAK} animate-pulse`} />
            <div className={`size-4 rounded ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/$projectId/domains
   ───────────────────────────────────────────── */

export function ProjectDomainsPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 py-8" aria-hidden="true">
      <div className="flex items-center justify-between">
        <TabHeaderSkeleton />
        <div className={`h-9 w-32 rounded-[4px] ${PULSE_BG_MEDIUM} animate-pulse`} />
      </div>
      <div className="h-9 max-w-[320px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex h-[68px] items-center gap-3 border-b-[0.5px] border-dash-border px-4 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className={`h-3.5 w-48 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
              <div className={`h-2.5 w-24 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`size-1.5 rounded-full ${PULSE_BG_MEDIUM} animate-pulse`} />
              <div className={`h-3 w-14 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            </div>
            <div className={`h-3 w-20 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            <div className={`size-4 rounded ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/$projectId/logs
   Filter bar + terminal-style rows
   ───────────────────────────────────────────── */

export function ProjectLogsPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 py-8" aria-hidden="true">
      <TabHeaderSkeleton />
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-9 flex-1 min-w-[220px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-9 w-[160px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
        <div className="h-9 w-[140px] animate-pulse rounded-[4px] border border-dash-border bg-dash-bg-elevated/30" />
      </div>
      <div className="rounded-[4px] border-[0.5px] border-dash-border bg-[#0c0c0e] p-3">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <div className="h-2.5 w-16 animate-pulse rounded bg-white/10" />
            <div className="h-2.5 w-10 animate-pulse rounded bg-white/15" />
            <div className="h-2.5 flex-1 animate-pulse rounded bg-white/8" style={{ maxWidth: `${30 + ((i * 17) % 60)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/$projectId/observability
   Header + interval picker + 2 gauges + chart card
   ───────────────────────────────────────────── */

export function ObservabilityPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 py-8" aria-hidden="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabHeaderSkeleton />
        <div className={`h-9 w-32 rounded-[4px] ${PULSE_BG_MEDIUM} animate-pulse`} />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col gap-3 rounded-[4px] border-[0.5px] border-dash-border p-5">
            <div className={`h-3.5 w-24 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
            <div className={`h-2.5 w-40 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            <div className={`mx-auto mt-2 h-[120px] w-[200px] rounded-t-full ${PULSE_BG_WEAK} animate-pulse`} />
          </div>
        ))}
      </div>
      <div className="rounded-[4px] border-[0.5px] border-dash-border">
        <div className="flex items-center gap-1 border-b-[0.5px] border-dash-border px-2 py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-7 w-20 rounded ${PULSE_BG_WEAK} animate-pulse`} />
          ))}
        </div>
        <div className="p-5">
          <div className={`h-[260px] w-full rounded ${PULSE_BG_WEAK} animate-pulse`} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/$projectId/web-analytics
   Header + chart + map + tables
   ───────────────────────────────────────────── */

export function WebAnalyticsPending() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 py-8" aria-hidden="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabHeaderSkeleton />
        <div className={`h-9 w-32 rounded-[4px] ${PULSE_BG_MEDIUM} animate-pulse`} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-[88px]" />
        ))}
      </div>
      <Block className="h-[280px]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Block className="h-[260px]" />
        <Block className="h-[260px]" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /projects/new
   Header + source selection cards
   ───────────────────────────────────────────── */

export function NewProjectPending() {
  return (
    <div className="mx-auto w-full max-w-[680px] py-8" aria-hidden="true">
      <div className="mb-8">
        <div className={`mb-4 h-4 w-28 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
        <div className={`mb-2 h-7 w-40 rounded ${PULSE_BG_STRONG} animate-pulse`} />
        <div className={`h-3.5 w-full max-w-[420px] rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
      </div>

      <div className={`mb-4 h-4 w-56 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex min-h-[132px] flex-col gap-3 rounded-[4px] border-[0.5px] border-dash-border p-5">
            <div className={`h-5 w-5 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            <div className="flex flex-col gap-1.5">
              <div className={`h-3.5 w-36 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
              <div className={`h-3 w-full max-w-[230px] rounded ${PULSE_BG_WEAK} animate-pulse`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   /scaling
   Header + search row + scaling cards
   ───────────────────────────────────────────── */

export function ScalingPending() {
  return (
    <div className="mx-auto w-full max-w-[1000px] py-8" aria-hidden="true">
      <div className="mb-8">
        <div className="mb-2 h-4 w-24 rounded bg-dash-border-soft/70 animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-[400px] max-w-full rounded bg-dash-border-soft/50 animate-pulse" />
          <div className="h-3 w-[300px] max-w-full rounded bg-dash-border-soft/50 animate-pulse" />
        </div>
      </div>

      <hr className="-ml-4 mb-6 border-dash-border-soft md:-ml-10" />

      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 min-w-0 flex-1 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/30 animate-pulse" />
        <div className={`h-10 w-[180px] rounded-[6px] ${PULSE_BG_MEDIUM} animate-pulse`} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex h-[164px] flex-col rounded-[4px] border-[0.5px] border-dash-border">
            <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
              <div className={`h-4 w-28 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
              <div className={`h-4 w-20 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            </div>
            <div className="px-3.5 pb-3">
              <div className={`h-3 w-32 rounded ${PULSE_BG_WEAK} animate-pulse`} />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 px-3.5 pb-3">
              <div className="space-y-2">
                <div className={`h-3 w-16 rounded ${PULSE_BG_WEAK} animate-pulse`} />
                <div className={`h-4 w-20 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
                <div className={`h-3 w-16 rounded ${PULSE_BG_WEAK} animate-pulse`} />
              </div>
              <div className="space-y-2">
                <div className={`h-3 w-16 rounded ${PULSE_BG_WEAK} animate-pulse`} />
                <div className={`h-3 w-20 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
                <div className={`h-3 w-20 rounded ${PULSE_BG_MEDIUM} animate-pulse`} />
              </div>
            </div>
            <div className="mt-auto h-10 border-t-[0.5px] border-dash-border" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { Bar, Block };
