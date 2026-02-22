import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DomainList, type Domain } from "../../../../components/shared/domain-list";
import { TabHeader } from "../../../../components/shared/tab-header";
import {
  AddDomainModal,
  type DomainValidationError,
} from "../../../../components/shared/add-domain-modal";

export const Route = createFileRoute("/projects/$projectId/domains/")({
  component: ProjectDomainsPage,
});

const domains: Domain[] = [
  {
    name: "www.audioly.brimble.app",
    project: "Audioly",
    status: "Active",
    addedAt: "Added 2 months ago",
    addedBy: "By Kemdirim Akujuobi",
  },
  {
    name: "audioly.com",
    project: "Audioly",
    status: "Failed",
    addedAt: "Added 2 months ago",
    addedBy: "By Kemdirim Akujuobi",
  },
  {
    name: "app.audioly.com",
    project: "Audioly",
    status: "Active",
    addedAt: "Added 1 month ago",
    addedBy: "By Kemdirim Akujuobi",
  },
];

const mockProjects = [
  { id: "1", name: "audioly" },
  { id: "2", name: "kemdirimdesign" },
  { id: "3", name: "brimble-docs" },
];

const ownedDomains = ["audioly.com", "app.audioly.com", "www.audioly.brimble.app"];

function validateDomain(url: string): DomainValidationError | null {
  const domain = url.trim().toLowerCase();
  if (!domain) return null;

  if (ownedDomains.includes(domain)) {
    return {
      type: "already-owned",
      message: "You already own this domain, try another one.",
    };
  }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
    return {
      type: "invalid",
      message: "Please enter a valid domain name.",
    };
  }

  if (domain.endsWith(".xyz") || domain.endsWith(".test")) {
    return {
      type: "not-found",
      message: "This domain is not registered.",
    };
  }

  return null;
}

function ProjectDomainsPage() {
  const { projectId } = Route.useParams();
  const [addDomainOpen, setAddDomainOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 py-8">
      <TabHeader title="Project domains">
        Manage all your domains on this project. You get a default
        ".brimble.com" domain with each project you deploy.
      </TabHeader>

      <DomainList
        domains={domains}
        basePath={`/projects/${projectId}/domains`}
        onAddDomain={() => setAddDomainOpen(true)}
      />

      <AddDomainModal
        open={addDomainOpen}
        onOpenChange={setAddDomainOpen}
        projects={mockProjects}
        onValidate={validateDomain}
        onContinue={(selectedProjectId, domainUrl) => {
          // TODO: wire to API — add domain to selected project
          console.log("Add domain:", domainUrl, "to project:", selectedProjectId);
        }}
        onRegisterDomain={(domainUrl) => {
          // TODO: navigate to domain registration flow
          console.log("Register domain:", domainUrl);
        }}
      />
    </div>
  );
}
