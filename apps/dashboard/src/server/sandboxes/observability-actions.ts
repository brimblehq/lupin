import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh } from "@/server/shared/backend";

interface MetricsInput {
  sandboxId: string;
  hrsAgo?: number;
}

export const getSandboxObservabilityMetricsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as MetricsInput | undefined;
  const sandboxId = payload?.sandboxId?.trim();
  if (!sandboxId) {
    throw new Error("Sandbox ID is required");
  }

  return withTokenRefresh((api) =>
    api.observability.getSandboxMetrics({
      sandboxId,
      hrsAgo: payload?.hrsAgo,
    }),
  );
});
