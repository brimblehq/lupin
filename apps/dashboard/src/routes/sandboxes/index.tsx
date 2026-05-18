import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Cube } from "@phosphor-icons/react";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { FilterDropdown, type FilterOption } from "@/components/shared/filter-dropdown";
import { CreateSandboxCard } from "@/components/sandboxes/create-sandbox-card";
import { SandboxCard } from "@/components/sandboxes/sandbox-card";
import { SandboxDrawer } from "@/components/sandboxes/sandbox-drawer";
import { MOCK_SANDBOXES, type Sandbox, type SandboxStatus } from "@/lib/sandboxes/mock-data";

export const Route = createFileRoute("/sandboxes/")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: SandboxesListPage,
});

const STATUS_OPTIONS: FilterOption[] = [
  { label: "All Sandboxes", value: "all" },
  { label: "Running", value: "ACTIVE", dot: "#13d282" },
  { label: "Building", value: "BUILDING", dot: "#ff7a00" },
  { label: "Stopped", value: "STOPPED", dot: "#9ca3af" },
  { label: "Failed", value: "FAILED", dot: "#fc391e" },
];

function SandboxesListPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [active, setActive] = useState<Sandbox | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_SANDBOXES.filter((sandbox) => {
      if (statusFilter !== "all" && sandbox.status !== (statusFilter as SandboxStatus)) {
        return false;
      }
      if (!q) return true;
      return (
        sandbox.name.toLowerCase().includes(q) ||
        sandbox.template.toLowerCase().includes(q) ||
        sandbox.region.toLowerCase().includes(q) ||
        (sandbox.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter]);

  let emptyMessage = "No sandboxes yet — spin one up to get started.";
  if (query.trim()) {
    emptyMessage = `No sandboxes found for "${query.trim()}".`;
  } else if (statusFilter !== "all") {
    emptyMessage = "No sandboxes match this status.";
  }

  return (
    <>
      <div className="mb-4">
        <SearchFilterBar
          value={query}
          onChange={setQuery}
          placeholder="Search sandboxes"
          rightSlot={
            <FilterDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              placeholder="All Statuses"
              dropdownWidth={180}
            />
          }
        />
      </div>

      <div className="mb-4">
        <CreateSandboxCard className="col-span-full" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${query}:${statusFilter}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((sandbox) => (
              <motion.div layout key={sandbox.id}>
                <SandboxCard sandbox={sandbox} onOpen={() => setActive(sandbox)} />
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center py-10">
              <Cube size={40} weight="fill" className="mb-2 text-dash-text-faded/50" />
              <span className="text-sm text-dash-text-faded">{emptyMessage}</span>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <SandboxDrawer
        sandbox={active}
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      />
    </>
  );
}
