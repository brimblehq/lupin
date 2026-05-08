import { Fragment } from "react";

function Bar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-dash-border-soft ${className ?? ""}`} />;
}

function NavyBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#cfe0ff]/10 ${className ?? ""}`} />;
}

function MetricBlock() {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2.5">
        <div className="size-6 shrink-0 animate-pulse rounded-full bg-[#cfe0ff]/15" />
        <NavyBar className="h-9 w-20" />
      </div>
      <NavyBar className="ml-[34px] h-2.5 w-24" />
    </div>
  );
}

function ListRow({ withIcon = false, last = false }: { withIcon?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${last ? "" : "border-b-[0.5px] border-dash-border-soft"}`}>
      <div className="flex min-w-0 items-center gap-2">
        {withIcon && <div className="size-3 shrink-0 animate-pulse rounded-sm bg-dash-border-soft" />}
        <Bar className="h-3 w-32" />
      </div>
      <Bar className="h-3 w-14" />
    </div>
  );
}

function ListCardSkeleton({
  rows = 5,
  withIcons = false,
  withSeeAll = false,
}: {
  rows?: number;
  withIcons?: boolean;
  withSeeAll?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col rounded-lg border-[0.5px] border-dash-border">
      <div className="flex items-start justify-between gap-3 border-b-[0.5px] border-dash-border px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Bar className="h-3.5 w-24" />
          <Bar className="h-2.5 w-36" />
        </div>
        {withSeeAll && <Bar className="h-2.5 w-10" />}
      </div>
      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, i) => (
          <ListRow key={i} withIcon={withIcons} last={i === rows - 1} />
        ))}
      </div>
    </div>
  );
}

function BarChartBars() {
  const heights = [40, 80, 60, 95, 50, 110, 70, 130, 90, 150, 85, 120];
  return (
    <div className="mt-6 flex h-[320px] items-end gap-1">
      {heights.map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="w-full animate-pulse rounded-lg bg-dash-border-soft" style={{ height: h }} />
          <Bar className="h-2 w-6" />
        </div>
      ))}
    </div>
  );
}

export function AppAnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Bar className="h-4 w-32" />
          <Bar className="h-3 w-72" />
        </div>
        <Bar className="h-7 w-28 shrink-0 rounded-lg" />
      </div>

      {/* TLDR */}
      <div className="flex flex-col gap-6 overflow-hidden rounded-lg bg-[#0a1430] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:pl-7 sm:pr-10 sm:py-7">
        <div className="flex flex-col gap-2">
          <NavyBar className="h-2.5 w-24" />
          <NavyBar className="h-2.5 w-44" />
          <NavyBar className="h-2.5 w-36" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-6 sm:w-auto sm:flex-nowrap sm:gap-10">
          <MetricBlock />
          <MetricBlock />
          <MetricBlock />
          <MetricBlock />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Bar className="h-6 w-24 rounded-full" />
      </div>

      {/* Site Visitors chart */}
      <div className="rounded-lg border-[0.5px] border-dash-border p-5">
        <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Bar className="h-3 w-20" />
            <Bar className="h-8 w-44" />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Bar className="h-7 w-44 rounded-lg" />
            <Bar className="h-7 w-24 rounded-lg" />
          </div>
        </div>
        <BarChartBars />
      </div>

      {/* Page performance */}
      <div className="flex flex-col rounded-lg border-[0.5px] border-dash-border">
        <div className="flex flex-col gap-1.5 border-b-[0.5px] border-dash-border px-4 py-3">
          <Bar className="h-3.5 w-32" />
          <Bar className="h-2.5 w-52" />
        </div>
        <div className="flex flex-col gap-6 px-5 py-5 sm:flex-row sm:items-stretch sm:gap-10">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 flex-col gap-2">
              <Bar className="h-2.5 w-10" />
              <Bar className="h-7 w-20" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t-[0.5px] border-dash-border-soft px-5 py-3">
          <Bar className="h-3 w-28" />
          <Bar className="h-3 w-14" />
        </div>
      </div>

      {/* Top pages + Funnel */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <ListCardSkeleton rows={4} withSeeAll />
        <ListCardSkeleton rows={4} withIcons />
      </div>

      {/* Visitors map */}
      <div className="flex flex-col rounded-lg border-[0.5px] border-dash-border">
        <div className="flex flex-col gap-2 border-b-[0.5px] border-dash-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Bar className="h-3.5 w-44" />
            <Bar className="h-2.5 w-56" />
          </div>
          <Bar className="h-7 w-32 rounded-lg" />
        </div>
        <div className="flex w-full items-center justify-center bg-dash-bg-elevated px-4 py-6" style={{ height: 460 }}>
          <div className="size-full max-w-[900px] animate-pulse rounded-lg bg-dash-border-soft" />
        </div>
      </div>

      {/* Countries + Browsers/Devices */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <ListCardSkeleton rows={5} withIcons withSeeAll />
        <div className="flex flex-1 flex-col rounded-lg border-[0.5px] border-dash-border">
          <div className="flex flex-col gap-2 border-b-[0.5px] border-dash-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Bar className="h-3.5 w-48" />
            <Bar className="h-7 w-36 rounded-lg" />
          </div>
          <div className="flex flex-col">
            {Array.from({ length: 5 }).map((_, i) => (
              <Fragment key={i}>
                <ListRow last={i === 4} />
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Languages + Custom events */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <ListCardSkeleton rows={5} withIcons withSeeAll />
        <ListCardSkeleton rows={5} withSeeAll />
      </div>

      {/* Custom data */}
      <div className="flex flex-1 flex-col rounded-lg border-[0.5px] border-dash-border">
        <div className="flex flex-col gap-1.5 border-b-[0.5px] border-dash-border px-4 py-3">
          <Bar className="h-3.5 w-24" />
          <Bar className="h-2.5 w-44" />
        </div>
        <div className="flex flex-col">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b-[0.5px] border-dash-border-soft px-4 py-2.5">
            <Bar className="h-2.5 w-16" />
            <Bar className="h-2.5 w-20" />
            <Bar className="h-2.5 w-10" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-4 py-2.5 ${i < 3 ? "border-b-[0.5px] border-dash-border-soft" : ""}`}
            >
              <Bar className="h-3 w-20" />
              <Bar className="h-3 w-24" />
              <Bar className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
