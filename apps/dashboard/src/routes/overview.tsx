import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/overview" as any)({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/", search: search as Record<string, unknown> });
  },
});
