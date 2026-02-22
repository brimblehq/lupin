import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "../../components/shared/page-header";
import { DomainList, type Domain } from "../../components/shared/domain-list";
import {
  AddDomainModal,
  type DomainValidationError,
} from "../../components/shared/add-domain-modal";

export const Route = createFileRoute("/domains/")({
  component: DomainsPage,
});

const domains: Domain[] = [
  {
    name: "kemdirim.com",
    project: "Third party",
    status: "Active",
    addedAt: "Added 5 months ago",
    addedBy: "By Kemdirim Akujuobi",
  },
  {
    name: "kemdirim.com",
    project: "Third party",
    status: "Active",
    addedAt: "Added 5 months ago",
    addedBy: "By Kemdirim Akujuobi",
  },
  {
    name: "kem.design",
    project: "Third party",
    status: "Failed",
    addedAt: "Added 5 months ago",
    addedBy: "By Kemdirim Akujuobi",
  },
];

const mockProjects = [
  { id: "1", name: "kemdirimdesign" },
  { id: "2", name: "audioly" },
  { id: "3", name: "brimble-docs" },
  { id: "4", name: "portfolio-v2" },
  { id: "5", name: "api-gateway" },
];

// Mock: domains the user already owns
const ownedDomains = ["kemdirim.com", "kem.design"];

function validateDomain(url: string): DomainValidationError | null {
  const domain = url.trim().toLowerCase();

  if (!domain) return null;

  // Check if already owned
  if (ownedDomains.includes(domain)) {
    return {
      type: "already-owned",
      message: "You already own this domain, try another one.",
    };
  }

  // Basic format validation
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
    return {
      type: "invalid",
      message: "Please enter a valid domain name.",
    };
  }

  // Mock: simulate a domain that doesn't exist
  if (domain.endsWith(".xyz") || domain.endsWith(".test")) {
    return {
      type: "not-found",
      message: "This domain is not registered.",
    };
  }

  return null;
}

function DomainsPage() {
  const [addDomainOpen, setAddDomainOpen] = useState(false);

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Domains">
        Welcome to faster frontend deployments! You have used{" "}
        <span className="font-semibold text-dash-text-body">4/10</span> of your
        free deployments, you can upgrade to a Pro plan to access unlimited
        deployments.
      </PageHeader>

      <DomainList
        domains={domains}
        basePath="/domains"
        onAddDomain={() => setAddDomainOpen(true)}
      />

      <AddDomainModal
        open={addDomainOpen}
        onOpenChange={setAddDomainOpen}
        projects={mockProjects}
        onValidate={validateDomain}
        onContinue={(projectId, domainUrl) => {
          // TODO: wire to API — add domain to selected project
          console.log("Add domain:", domainUrl, "to project:", projectId);
        }}
        onRegisterDomain={(domainUrl) => {
          // TODO: navigate to domain registration flow
          console.log("Register domain:", domainUrl);
        }}
      />
    </div>
  );
}
