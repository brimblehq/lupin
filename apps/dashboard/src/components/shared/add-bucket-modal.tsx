import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "./modal";
import { dashInputClassName } from "./dash-input";
import { Dropdown, type DropdownOption } from "./dropdown";
import { Spinner } from "./spinner";
import { SimpleTooltip } from "./tooltip";
import type { StorageRegion } from "@/backend/storage";
import { generateResourceName } from "@/lib/resource-names";
import { listStorageRegionsServerFn, searchBucketsServerFn } from "@/server/storage/actions";

interface AddBucketModalProps {
  open: boolean;
  workspace?: string;
  onOpenChange: (open: boolean) => void;
  onContinue: (data: AddBucketFormValues) => Promise<void>;
}

const visibilityOptions: DropdownOption[] = [
  { id: "private", label: "Private" },
  { id: "public", label: "Public" },
];

const BUCKET_NAME_CHECK_DEBOUNCE_MS = 350;
const BUCKET_NAME_CHECK_LIMIT = 5;
const BUCKET_NAME_PATTERN = /^[a-z0-9-]+$/;

type BucketNameCheckStatus = "idle" | "checking" | "available" | "unavailable";

export interface AddBucketFormValues {
  name: string;
  region: string;
  isPublic: boolean;
}

export function AddBucketModal({ open, workspace, onOpenChange, onContinue }: AddBucketModalProps) {
  const listStorageRegions = useServerFn(listStorageRegionsServerFn);
  const searchBuckets = useServerFn(searchBucketsServerFn);
  const [bucketName, setBucketName] = useState("");
  const [bucketRegion, setBucketRegion] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [nameSpin, setNameSpin] = useState(0);
  const [nameCheckStatus, setNameCheckStatus] = useState<BucketNameCheckStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [regions, setRegions] = useState<StorageRegion[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const defaultRegionId = regions.find((region) => region.default)?.id ?? regions[0]?.id ?? "";
  const selectedRegion = regions.find((region) => region.id === bucketRegion);
  const regionOptions = useMemo<DropdownOption[]>(() => {
    if (regionsLoading) {
      return [{ id: "__loading", label: "Loading regions...", disabled: true }];
    }

    return regions.map((region) => ({
      id: region.id,
      label: region.name,
      asideText: region.geography,
    }));
  }, [regions, regionsLoading]);

  useEffect(() => {
    if (!open) return;
    setBucketName((current) => current || generateResourceName());

    let active = true;
    setRegionsLoading(true);
    setRegionsError(null);

    void listStorageRegions()
      .then((nextRegions) => {
        if (!active) return;
        setRegions(nextRegions);
        const nextDefaultRegionId = nextRegions.find((region) => region.default)?.id ?? nextRegions[0]?.id ?? "";
        setBucketRegion((current) => current || nextDefaultRegionId);
      })
      .catch((error) => {
        if (!active) return;
        setRegions([]);
        setRegionsError(error instanceof Error ? error.message : "Failed to load storage regions");
      })
      .finally(() => {
        if (active) setRegionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listStorageRegions, open]);

  useEffect(() => {
    if (!open) return;

    const normalizedName = bucketName.trim().toLowerCase();
    if (!normalizedName || !BUCKET_NAME_PATTERN.test(normalizedName)) {
      setNameCheckStatus("idle");
      return;
    }

    let active = true;
    setNameCheckStatus("checking");

    const timeout = window.setTimeout(() => {
      void searchBuckets({
        data: {
          workspace,
          q: normalizedName,
          page: 1,
          limit: BUCKET_NAME_CHECK_LIMIT,
        },
      })
        .then((result) => {
          if (!active) return;
          const exists = result.items.some((bucket) => {
            const displayName = bucket.name.trim().toLowerCase();
            const providerName = bucket.bucket_name?.trim().toLowerCase();
            return displayName === normalizedName || providerName === normalizedName;
          });
          setNameCheckStatus(exists ? "unavailable" : "available");
        })
        .catch(() => {
          if (active) setNameCheckStatus("idle");
        });
    }, BUCKET_NAME_CHECK_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [bucketName, open, searchBuckets, workspace]);

  async function handleCreate() {
    const normalizedName = bucketName.trim().toLowerCase();

    if (!normalizedName) {
      setError("Bucket name is required.");
      return;
    }

    if (!BUCKET_NAME_PATTERN.test(normalizedName)) {
      setError("Bucket name can only contain lowercase letters, numbers, and hyphens.");
      return;
    }

    if (nameCheckStatus === "checking") {
      return;
    }

    if (nameCheckStatus === "unavailable") {
      setError("A bucket with this name already exists.");
      return;
    }

    if (!bucketRegion) {
      setRegionsError("Select a storage location.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onContinue({
        name: normalizedName,
        region: bucketRegion,
        isPublic: visibility === "public",
      });
      handleOpenChange(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create bucket");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setBucketName("");
      setBucketRegion(defaultRegionId);
      setVisibility("private");
      setNameCheckStatus("idle");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={500}>
      <ModalHeader title="Create storage bucket" description="Create a new object storage bucket for your project." />

      <div className="flex flex-col gap-4 px-6 pb-5 pt-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-dash-text-strong">Name</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Name"
              value={bucketName}
              onChange={(e) => {
                setBucketName(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`${dashInputClassName} pr-16`}
            />
            {nameCheckStatus === "checking" && (
              <div className="pointer-events-none absolute right-9 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-dash-text-faded">
                <Spinner size="size-3.5" />
              </div>
            )}
            <SimpleTooltip content="Generate a name">
              <button
                type="button"
                aria-label="Generate a random bucket name"
                onClick={() => {
                  setNameSpin((spin) => spin + 1);
                  setBucketName(generateResourceName());
                  if (error) setError(null);
                }}
                className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
              >
                <ArrowsClockwise
                  className="size-4 transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${nameSpin * 180}deg)` }}
                />
              </button>
            </SimpleTooltip>
          </div>
          <p className="text-xs leading-[1.4] text-dash-text-faded">Bucket names cannot be changed after creation.</p>
          {nameCheckStatus === "unavailable" && <p className="text-xs text-[#e1291d]">A bucket with this name already exists.</p>}
          {error && <p className="text-xs text-[#e1291d]">{error}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-dash-text-strong">Storage location</label>
          <Dropdown
            value={bucketRegion}
            options={regionOptions}
            onChange={(regionId) => {
              setBucketRegion(regionId);
              setRegionsError(null);
            }}
            placeholder={regionsLoading ? "Loading regions..." : "Select region"}
          />
          {selectedRegion?.description && <p className="text-xs leading-[1.4] text-dash-text-faded">{selectedRegion.description}</p>}
          {regionsError && <p className="text-xs text-[#e1291d]">{regionsError}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-dash-text-strong">Bucket visibility</label>
          <Dropdown value={visibility} options={visibilityOptions} onChange={setVisibility} placeholder="Select visibility" />
        </div>
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton
          onClick={handleCreate}
          disabled={
            !bucketName.trim() || !bucketRegion || regionsLoading || nameCheckStatus === "checking" || nameCheckStatus === "unavailable"
          }
          loading={submitting}
          loadingLabel="Creating..."
        >
          Create storage bucket
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}
