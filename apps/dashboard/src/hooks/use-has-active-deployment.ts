import { useState, useEffect, useCallback, useRef } from "react";
import { listDeploymentsServerFn } from "@/server/deployments/actions";
import type { PaginatedDeploymentsResponse } from "@/backend/deployments";

const ACTIVE_STATUSES = new Set(["inprogress", "building", "pending", "queued"]);
const POLL_INTERVAL = 5000;

export function useHasActiveDeployment(
  projectId: string | undefined,
  workspace?: string,
): boolean {
  const [hasActive, setHasActive] = useState(false);
  const hasActiveRef = useRef(false);

  const checkDeployments = useCallback(async () => {
    if (!projectId) {
      setHasActive(false);
      return;
    }

    try {
      const result = await (listDeploymentsServerFn as unknown as (input: {
        data: {
          projectId: string;
          workspace?: string;
          limit?: number;
        };
      }) => Promise<PaginatedDeploymentsResponse>)({
        data: {
          projectId,
          workspace,
          limit: 5,
        },
      });

      const active =
        result?.items?.some((item) =>
          ACTIVE_STATUSES.has(item.status?.toLowerCase() ?? ""),
        ) ?? false;

      if (active !== hasActiveRef.current) {
        hasActiveRef.current = active;
        setHasActive(active);
      }
    } catch {
      // Silently ignore -- notification dot should never break UI
    }
  }, [projectId, workspace]);

  useEffect(() => {
    void checkDeployments();

    function poll() {
      if (document.visibilityState === "visible") {
        void checkDeployments();
      }
    }

    const intervalId = window.setInterval(poll, POLL_INTERVAL);

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void checkDeployments();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkDeployments]);

  return hasActive;
}
