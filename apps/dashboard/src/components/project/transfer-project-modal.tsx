import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import type { Workspace } from "@/backend/workspaces";
import { transferProjectServerFn } from "@/server/projects/actions";
import { listWorkspacesServerFn } from "@/server/workspaces/actions";
import { buildWorkspaceSwitchUrl } from "@/utils/topbar-navigation";
import { Dropdown } from "@/components/shared/dropdown";
import { Modal, ModalCancelButton, ModalContinueButton, ModalFooter, ModalHeader } from "@/components/shared/modal";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

interface TransferProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentWorkspaceSlug?: string;
}

export function TransferProjectModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  currentWorkspaceSlug,
}: TransferProjectModalProps) {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });

  const listWorkspaces = useServerFn(listWorkspacesServerFn as any) as () => Promise<{ items: Workspace[] }>;
  const transferProject = useServerFn(transferProjectServerFn as any) as (args: {
    data: { projectId: string; teamId: string };
  }) => Promise<{ id?: string; team?: string; environmentId?: string }>;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [destinationWorkspaceId, setDestinationWorkspaceId] = useState("");

  const destinationWorkspaces = useMemo(() => {
    return workspaces.filter((workspace) => {
      if (!workspace.id) {
        return false;
      }

      if (!currentWorkspaceSlug) {
        return true;
      }

      return workspace.slug !== currentWorkspaceSlug;
    });
  }, [workspaces, currentWorkspaceSlug]);

  useEffect(() => {
    if (!open) {
      setDestinationWorkspaceId("");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoadingWorkspaces(true);
        const response = await listWorkspaces();
        const nextWorkspaces = Array.isArray(response?.items) ? response.items : [];
        if (cancelled) {
          return;
        }
        setWorkspaces(nextWorkspaces);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load workspaces");
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspaces(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, listWorkspaces]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!destinationWorkspaces.length) {
      setDestinationWorkspaceId("");
      return;
    }

    const hasCurrentSelection = destinationWorkspaces.some((workspace) => workspace.id === destinationWorkspaceId);
    if (!hasCurrentSelection) {
      setDestinationWorkspaceId(destinationWorkspaces[0]?.id ?? "");
    }
  }, [open, destinationWorkspaces, destinationWorkspaceId]);

  const destinationOptions = useMemo(
    () =>
      destinationWorkspaces.map((workspace) => ({
        id: workspace.id,
        label: workspace.name || workspace.slug || workspace.id,
      })),
    [destinationWorkspaces],
  );

  async function handleTransfer() {
    const trimmedProjectId = projectId.trim();
    if (!trimmedProjectId) {
      toast.error("Project ID is required");
      return;
    }

    const teamId = destinationWorkspaceId.trim();
    if (!teamId) {
      toast.error("Please select a destination workspace");
      return;
    }

    try {
      setTransferring(true);
      await transferProject({
        data: {
          projectId: trimmedProjectId,
          teamId,
        },
      });

      const destinationWorkspace = destinationWorkspaces.find((workspace) => workspace.id === teamId);
      const nextUrl = buildWorkspaceSwitchUrl({
        pathname,
        searchStr,
        workspaceSlug: destinationWorkspace?.slug,
      });

      onOpenChange(false);
      toast.success("Project transferred successfully");

      await invalidateActiveMatches(router);
      await navigate({
        to: nextUrl as any,
        replace: true,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to transfer project");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalHeader title="Transfer project" description={`Move ${projectName} to another workspace`} />
      <div className="flex flex-col gap-4 px-6 pb-5 pt-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Project</label>
          <div className="rounded-[6px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2.5 text-sm text-dash-text-body">
            {projectName}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.022px] text-dash-text-strong">Destination workspace</label>
          <Dropdown
            value={destinationWorkspaceId}
            options={destinationOptions}
            onChange={setDestinationWorkspaceId}
            placeholder={loadingWorkspaces ? "Loading workspaces..." : "Select workspace..."}
          />
          {!loadingWorkspaces && destinationOptions.length === 0 ? (
            <p className="text-xs leading-5 text-dash-text-faded">No other workspaces available for transfer.</p>
          ) : null}
        </div>
      </div>
      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton onClick={handleTransfer} disabled={transferring || !destinationWorkspaceId} loading={transferring}>
          Transfer
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}
