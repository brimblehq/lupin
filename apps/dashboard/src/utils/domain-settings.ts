import type { DomainDetailsRecord } from "@/backend/domains";
import type { DomainInfo } from "@/components/shared/domain-settings";
import { isDateExpired } from "@/utils/date";

function formatTtlSeconds(ttl?: number): string {
  if (typeof ttl !== "number" || ttl <= 0) {
    return "Auto";
  }

  const days = Math.floor(ttl / 86400);
  if (days > 0 && ttl % 86400 === 0) {
    if (days === 1) {
      return "1 day";
    }
    return `${days} days`;
  }

  const hours = Math.floor(ttl / 3600);
  if (hours > 0 && ttl % 3600 === 0) {
    if (hours === 1) {
      return "1 hour";
    }
    return `${hours} hours`;
  }

  const minutes = Math.floor(ttl / 60);
  if (minutes > 0 && ttl % 60 === 0) {
    if (minutes === 1) {
      return "1 min";
    }
    return `${minutes} mins`;
  }

  return `${ttl}s`;
}

function formatExpiryDate(value?: string): string {
  if (!value) {
    return "NA";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function getNameserversType(domain: DomainDetailsRecord): string {
  if (domain.enabled === true) {
    return "Brimble DNS";
  }

  if (domain.isCustom) {
    return "Custom domain";
  }

  return "Default";
}

function buildNameserverWarning(domain: DomainDetailsRecord): string | undefined {
  const nameserver = domain.nameserver;
  if (!nameserver) {
    return undefined;
  }

  const expected = nameserver.expected.map((item) => item.toLowerCase()).sort();
  const actual = nameserver.actual.map((item) => item.toLowerCase()).sort();

  if (expected.length === 0 || actual.length === 0) {
    return undefined;
  }

  if (expected.length !== actual.length) {
    return "You are currently using the wrong nameservers. Please use the provided nameservers below";
  }

  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i] !== actual[i]) {
      return "You are currently using the wrong nameservers. Please use the provided nameservers below";
    }
  }

  return undefined;
}

export function mapDomainDetailsToDomainInfo(domain: DomainDetailsRecord): DomainInfo {
  let displayNameservers = domain.nameservers || [];
  if (displayNameservers.length === 0 && domain.nameserver?.expected?.length) {
    displayNameservers = domain.nameserver.expected;
  }

  return {
    domainId: domain.id,
    domainName: domain.name,
    registrar: domain.registrar || (domain.isCustom ? "Custom domain" : "-"),
    nameserversType: getNameserversType(domain),
    expirationDate: formatExpiryDate(domain.expiresAt),
    creator: domain.creatorName || domain.createdByName || "Brimble",
    dnsRecords: domain.dnsRecords.map((record) => ({
      id: record.id,
      type: record.type || "-",
      name: record.name || domain.name,
      ttl: formatTtlSeconds(record.ttl),
      ttlSeconds: record.ttl,
      value: record.value || "-",
      isProxied: record.isProxied,
    })),
    nameservers: displayNameservers,
    nameserverWarning: buildNameserverWarning(domain),
    purchased: domain.purchased,
    active: domain.active,
    isExpired: domain.isExpired ?? isDateExpired(domain.expiresAt),
    renewalPrice: domain.renewalPrice,
    renewalDuration: domain.renewalDuration,
    autoRenewal: domain.autoRenewal,
  };
}
