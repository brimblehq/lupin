import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { VolumeCard } from "@/components/sandboxes/volume-card";
import { MOCK_VOLUMES } from "@/lib/sandboxes/volumes-mock-data";

export const Route = createFileRoute("/sandboxes/volumes")({
  staleTime: 300_000,
  preloadStaleTime: 300_000,
  component: VolumesListPage,
});

function VolumesListPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_VOLUMES;
    return MOCK_VOLUMES.filter((volume) => {
      return volume.name.toLowerCase().includes(q) || (volume.attachedTo?.toLowerCase().includes(q) ?? false);
    });
  }, [query]);

  const emptyMessage = query.trim() ? `No volumes found for "${query.trim()}".` : "No persistent volumes yet.";

  return (
    <>
      <div className="mb-4">
        <SearchFilterBar value={query} onChange={setQuery} placeholder="Search volumes" />
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
              {filtered.map((volume) => (
                <VolumeCard key={volume.id} volume={volume} />
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center py-10">
              <img src="/icons/storage.svg" alt="" className="mb-2 size-10 opacity-50 invert dark:invert-0" />
              <span className="text-sm text-dash-text-faded">{emptyMessage}</span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
