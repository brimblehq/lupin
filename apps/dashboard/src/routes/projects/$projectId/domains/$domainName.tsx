import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getDomainDetailsServerFn } from "@/server/domains/actions";
import { DomainSettings } from "../../../../components/shared/domain-settings";
import { mapDomainDetailsToDomainInfo } from "@/utils/domain-settings";

export const Route = createFileRoute("/projects/$projectId/domains/$domainName")({
  staleTime: 0,
  preloadStaleTime: 0,
  loader: async ({ params, context }) => {
    const workspace = (context as any).workspace;

    const domain = await (
      getDomainDetailsServerFn as unknown as (input: { data: { domainName: string; workspace?: string } }) => Promise<any>
    )({
      data: {
        domainName: decodeURIComponent(params.domainName),
        workspace,
      },
    });

    return { domain, workspace };
  },
  errorComponent: DomainErrorPage,
  component: ProjectDomainSettingsPage,
});

function DomainErrorPage({ error }: { error: Error }) {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-4 py-16">
      <h2 className="text-lg font-medium text-dash-text-strong">Domain not found</h2>
      <p className="text-sm text-dash-text-faded">{error?.message || "The domain could not be loaded."}</p>
      <button
        onClick={() => {
          void navigate({ to: `/projects/${projectId}/domains` as any });
        }}
        className="mt-2 rounded-[4px] border border-dash-border px-4 py-2 text-sm text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
      >
        Back to domains
      </button>
    </div>
  );
}

function ProjectDomainSettingsPage() {
  const { projectId } = Route.useParams();
  const { domain, workspace } = Route.useLoaderData();
  const domainInfo = mapDomainDetailsToDomainInfo(domain);

  let backPath = `/projects/${projectId}/domains`;
  if (workspace) {
    backPath = `${backPath}?workspace=${encodeURIComponent(workspace)}`;
  }

  return <DomainSettings domain={domainInfo} backPath={backPath} workspace={workspace} />;
}
