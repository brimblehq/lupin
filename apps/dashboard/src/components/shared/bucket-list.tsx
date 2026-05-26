import { useState } from "react";
import { Database } from "lucide-react";
import { SearchFilterBar } from "./search-filter-bar";
import { BucketCard } from "./bucket-card";
import { WarningModal } from "./warning-modal";
import { CreateBucketCard } from "./create-bucket-card";

export interface Bucket {
  id: string;
  name: string;
  projectId?: string;
  region?: string;
  createdAt: string;
  objectCount?: number;
  storageUsed?: number;
  quota?: number;
}

function getCreateCardSpan(count: number) {
  const smRemaining = count % 2 === 0 ? 2 : 2 - (count % 2);
  const lgRemaining = count % 3 === 0 ? 3 : 3 - (count % 3);
  const xlRemaining = count % 4 === 0 ? 4 : 4 - (count % 4);

  return [
    smRemaining >= 2 ? "sm:col-span-2" : "",
    lgRemaining >= 3 ? "lg:col-span-3" : lgRemaining >= 2 ? "lg:col-span-2" : "lg:col-span-1",
    xlRemaining >= 4 ? "xl:col-span-4" : xlRemaining >= 3 ? "xl:col-span-3" : xlRemaining >= 2 ? "xl:col-span-2" : "xl:col-span-1",
  ]
    .filter(Boolean)
    .join(" ");
}

export function BucketList({
  buckets,
  searchQuery: searchQueryProp,
  onSearchQueryChange,
  searchLoading = false,
  onDeleteBucket,
  onCreate,
}: {
  buckets: Bucket[];
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchLoading?: boolean;
  onDeleteBucket?: (bucket: Bucket) => Promise<void>;
  onCreate?: () => void;
}) {
  const [searchQueryInternal, setSearchQueryInternal] = useState("");
  const [deletingBucket, setDeletingBucket] = useState<Bucket | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  
  const searchQuery = searchQueryProp ?? searchQueryInternal;
  const setSearchQuery = onSearchQueryChange ?? setSearchQueryInternal;

  const filtered = buckets.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar & Filter */}
      <div className="flex w-full items-center">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search storage buckets..."
          loading={searchLoading}
          className="w-full max-w-[1000px] h-[48px]"
          rightSlot={
            <button className="flex h-full items-center justify-center gap-2 whitespace-nowrap bg-dash-bg-elevated px-4 text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-border">
              <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.35 1.95C10.35 2.61274 8.20097 3.15 5.55 3.15C2.89903 3.15 0.75 2.61274 0.75 1.95M10.35 1.95C10.35 1.28726 8.20097 0.75 5.55 0.75C2.89903 0.75 0.75 1.28726 0.75 1.95M10.35 1.95V3.00442C10.35 4.63433 9.70252 6.19748 8.55 7.35L7.49558 8.40442C7.01819 8.88181 6.75 9.52928 6.75 10.2044V11.55C6.75 12.2127 6.21274 12.75 5.55 12.75C4.88726 12.75 4.35 12.2127 4.35 11.55V10.2044C4.35 9.52928 4.0818 8.88181 3.60441 8.40442L2.55 7.35C1.39748 6.19748 0.75 4.63433 0.75 3.00442V1.95" stroke="#7A7C81" strokeWidth="1.5"/>
              </svg>
              Filter status
            </button>
          }
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-[4px] bg-dash-bg-elevated/40">
          <div className="flex size-8 items-center justify-center rounded-full bg-dash-bg-elevated text-dash-text-faded">
            <Database className="size-4" />
          </div>
          <span className="text-sm text-dash-text-faded">{buckets.length === 0 ? "No buckets yet" : "No buckets found"}</span>
        </div>
      )}

      {/* Buckets Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((bucket) => (
            <BucketCard 
              key={bucket.id} 
              bucket={bucket} 
              onDelete={() => {
                setDeleteConfirmName("");
                setDeletingBucket(bucket);
              }}
            />
          ))}
          {onCreate && (
            <CreateBucketCard
              onClick={onCreate}
              className={getCreateCardSpan(filtered.length)}
            />
          )}
        </div>
      )}

      <WarningModal
        open={Boolean(deletingBucket)}
        onOpenChange={(open) => {
          if (!open) setDeletingBucket(null);
        }}
        title="Delete this bucket?"
        description={`This action cannot be undone. All objects inside ${deletingBucket?.name} will be permanently deleted.`}
        confirmLabel="Delete bucket"
        cancelLabel="Cancel"
        confirmDisabled={deleteConfirmName !== deletingBucket?.name || deleting}
        onConfirm={async () => {
          if (deleting || !deletingBucket || !onDeleteBucket) return;
          try {
            setDeleting(true);
            await onDeleteBucket(deletingBucket);
            setDeletingBucket(null);
          } finally {
            setDeleting(false);
          }
        }}
      >
        <div className="flex flex-col gap-2 text-left">
          <label className="text-sm leading-5 text-dash-text-faded">
            Type <span className="font-medium text-dash-text-strong">{deletingBucket?.name}</span> to confirm
          </label>
          <input
            type="text"
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder={deletingBucket?.name}
            className="input-base input-focus-red w-full px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]"
          />
        </div>
      </WarningModal>
    </div>
  );
}
