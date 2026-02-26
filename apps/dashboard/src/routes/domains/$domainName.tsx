import { createFileRoute } from "@tanstack/react-router";
import { getDomainDetailsServerFn } from "@/server/domains/actions";
import {
  DomainSettings,
} from "../../components/shared/domain-settings";
import { mapDomainDetailsToDomainInfo } from "@/utils/domain-settings";

export const Route = createFileRoute("/domains/$domainName")({
  staleTime: 0,
  preloadStaleTime: 0,
  loader: async ({ params, location }) => {
    const searchParams = new URLSearchParams(location.searchStr || "");
    const workspace = searchParams.get("workspace") || undefined;

    const domain = await (getDomainDetailsServerFn as unknown as (input: {
      data: { domainName: string; workspace?: string };
    }) => Promise<any>)({
      data: {
        domainName: decodeURIComponent(params.domainName),
        workspace,
      },
    });

    return { domain, workspace };
  },
  component: DomainSettingsPage,
});

function DomainSettingsPage() {
  const { domain, workspace } = Route.useLoaderData();
  const domainInfo = mapDomainDetailsToDomainInfo(domain);

  let backPath = "/domains";
  if (workspace) {
    backPath = `/domains?workspace=${encodeURIComponent(workspace)}`;
  }

  return <DomainSettings domain={domainInfo} backPath={backPath} workspace={workspace} />;
}
