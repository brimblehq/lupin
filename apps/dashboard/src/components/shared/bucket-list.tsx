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

export function BucketList({
  buckets,
  searchQuery: searchQueryProp,
  onSearchQueryChange,
  searchLoading = false,
  onDeleteBucket,
  onCreate,
  disableClientFilter = false,
}: {
  buckets: Bucket[];
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchLoading?: boolean;
  onDeleteBucket?: (bucket: Bucket) => Promise<void>;
  onCreate?: () => void;
  disableClientFilter?: boolean;
}) {
  const [searchQueryInternal, setSearchQueryInternal] = useState("");
  const [deletingBucket, setDeletingBucket] = useState<Bucket | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const searchQuery = searchQueryProp ?? searchQueryInternal;
  const setSearchQuery = onSearchQueryChange ?? setSearchQueryInternal;

  const filtered = disableClientFilter ? buckets : buckets.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full items-center">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search storage buckets..."
          loading={searchLoading}
          className="w-full max-w-[1000px]"
        />
      </div>

      {onCreate && <CreateBucketCard onClick={onCreate} />}

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
