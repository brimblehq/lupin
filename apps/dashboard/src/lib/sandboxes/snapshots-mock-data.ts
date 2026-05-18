export type SnapshotStatus = "READY" | "CREATING" | "FAILED";

export interface Snapshot {
  id: string;
  slug: string;
  sandbox: string;
  cadence: string;
  sizeGb: number;
  status: SnapshotStatus;
  createdAt: string;
}

export const MOCK_SNAPSHOTS: Snapshot[] = [
  {
    id: "snp_01HKQ1A2B3",
    slug: "research-agent-2026-05-17-09",
    sandbox: "research-agent",
    cadence: "Daily",
    sizeGb: 12,
    status: "READY",
    createdAt: "2h ago",
  },
  {
    id: "snp_01HKQ2C4D5",
    slug: "research-agent-2026-05-16-09",
    sandbox: "research-agent",
    cadence: "Daily",
    sizeGb: 12,
    status: "READY",
    createdAt: "1d ago",
  },
  {
    id: "snp_01HKQ3E6F7",
    slug: "agent-output-manual-2026-05-15",
    sandbox: "agent-output",
    cadence: "Manual",
    sizeGb: 38,
    status: "READY",
    createdAt: "2d ago",
  },
  {
    id: "snp_01HKQ4G8H9",
    slug: "model-weights-weekly-2026-05-12",
    sandbox: "model-weights",
    cadence: "Weekly",
    sizeGb: 94,
    status: "READY",
    createdAt: "5d ago",
  },
  {
    id: "snp_01HKQ5I0J1",
    slug: "research-agent-manual-2026-05-17",
    sandbox: "research-agent",
    cadence: "Manual",
    sizeGb: 12,
    status: "CREATING",
    createdAt: "just now",
  },
  {
    id: "snp_01HKQ6K2L3",
    slug: "build-cache-2026-05-10",
    sandbox: "build-cache",
    cadence: "Daily",
    sizeGb: 8,
    status: "FAILED",
    createdAt: "7d ago",
  },
];
