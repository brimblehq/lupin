import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/teams/$teamName/transfer")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/",
      search: { workspace: params.teamName, transferOwnership: "1" },
    });
  },
});
