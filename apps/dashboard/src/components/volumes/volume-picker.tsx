import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { Dropdown } from "@/components/shared/dropdown";
import { Spinner } from "@/components/shared/spinner";
import { setPendingVolumesAction, withWorkspaceQuery } from "@/utils/topbar-navigation";
import { listVolumesServerFn } from "@/server/volumes/actions";
import { VolumeType, type VolumeResponse } from "@/backend/volumes";

const VOLUME_FETCH_LIMIT = 100;

interface VolumePickerProps {
  value: string;
  onChange: (volumeId: string) => void;
  regionId: string;
  volumeType: VolumeType;
  workspace?: string;
  searchStr?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function VolumePicker({
  value,
  onChange,
  regionId,
  volumeType,
  workspace,
  searchStr,
  disabled,
  placeholder = "Select a volume",
}: VolumePickerProps) {
  const listVolumes = useServerFn(listVolumesServerFn);
  const [volumes, setVolumes] = useState<VolumeResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const result = await listVolumes({ data: { workspace, limit: VOLUME_FETCH_LIMIT } });
        if (cancelled) return;
        setVolumes(result.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listVolumes, workspace]);

  const eligible = useMemo(
    () => volumes.filter((volume) => volume.type === volumeType && !volume.attachedSandboxId && !volume.attachedProjectId),
    [volumes, volumeType],
  );

  const options = useMemo(
    () =>
      eligible.map((volume) => {
        const mismatchedRegion = Boolean(regionId) && volume.region?.id !== regionId;
        return {
          id: volume.id,
          label: `${volume.name} · ${volume.sizeGB} GB`,
          disabled: mismatchedRegion,
          asideText: mismatchedRegion ? (volume.region?.name ?? "other region") : undefined,
        };
      }),
    [eligible, regionId],
  );

  useEffect(() => {
    if (!value) return;
    const stillEligible = options.some((option) => option.id === value && !option.disabled);
    if (!stillEligible) {
      onChange("");
    }
  }, [options, value, onChange]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-dash-text-faded">
        <Spinner size="size-3.5" />
        Loading volumes...
      </div>
    );
  }

  if (options.length === 0) {
    const target = withWorkspaceQuery({
      pathname: "/volumes",
      searchStr: appendSearchParams(searchStr, { create: "true", type: volumeType, region: regionId }),
    });

    return (
      <div className="flex flex-col gap-2 rounded-[4px] border-[0.5px] border-dashed border-dash-border px-3 py-3 text-sm text-dash-text-faded">
        <span>No detached {volumeType} volumes in this region.</span>
        <Link
          to={target as any}
          onClick={() => setPendingVolumesAction("create-volume")}
          className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-[#4879f8] transition-colors hover:text-[#3c6ce7]"
        >
          <Plus className="size-3.5" />
          Create one
        </Link>
      </div>
    );
  }

  return (
    <Dropdown
      value={value}
      options={options}
      onChange={onChange}
      placeholder={disabled ? "Disabled" : placeholder}
      searchable={options.length > 6}
    />
  );
}

function appendSearchParams(existing: string | undefined, params: Record<string, string>): string {
  const next = new URLSearchParams(existing ?? "");
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  return `?${next.toString()}`;
}
