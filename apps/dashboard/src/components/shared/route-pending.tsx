/**
 * Per-route pending skeletons. Each one mirrors the layout of the tab/page
 * it stands in for so the visual weight stays put while the loader resolves.
 *
 * Default export `RoutePending` is a generic shell used as the router-wide
 * fallback for routes that don't declare their own pendingComponent.
 */

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

export { Bar, Block };
