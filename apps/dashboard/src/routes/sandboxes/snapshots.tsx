import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { SnapshotCard } from "@/components/sandboxes/snapshot-card";
import { MOCK_SNAPSHOTS } from "@/lib/sandboxes/snapshots-mock-data";

export const Route = createFileRoute("/sandboxes/snapshots")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: SnapshotsListPage,
});

function SnapshotsListPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_SNAPSHOTS;
    return MOCK_SNAPSHOTS.filter((snapshot) => {
      return snapshot.sandbox.toLowerCase().includes(q) || snapshot.cadence.toLowerCase().includes(q);
    });
  }, [query]);

  const emptyMessage = query.trim() ? `No snapshots found for "${query.trim()}".` : "No snapshots yet.";

  return (
    <>
      <div className="mb-4">
        <SearchFilterBar value={query} onChange={setQuery} placeholder="Search snapshots" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={query}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {filtered.length > 0 ? (
            <div className="flex flex-col">
              {filtered.map((snapshot) => (
                <SnapshotCard key={snapshot.id} snapshot={snapshot} />
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center py-10">
              <img src="/icons/clock.svg" alt="" className="mb-2 size-10 opacity-50 invert dark:invert-0" />
              <span className="text-sm text-dash-text-faded">{emptyMessage}</span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
