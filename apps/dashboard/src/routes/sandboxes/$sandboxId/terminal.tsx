import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sandboxes/$sandboxId/terminal")({
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  // The parent layout (routes/sandboxes/$sandboxId.tsx) renders the persistent
  // terminal panel directly so its xterm state survives tab switches. This
  // route only exists so the /terminal URL resolves; the Outlet is hidden when
  // it matches, and this component renders nothing.
  component: () => null,
});
