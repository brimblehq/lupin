export type VolumeStatus = "ATTACHED" | "DETACHED" | "DELETING";

export interface Volume {
  id: string;
  slug: string;
  name: string;
  sizeGb: number;
  status: VolumeStatus;
  attachedTo?: string;
}

export const MOCK_VOLUMES: Volume[] = [
  {
    id: "vol_01HKP3Q1R2",
    slug: "workspace-cache",
    name: "workspace-cache",
    sizeGb: 20,
    status: "ATTACHED",
    attachedTo: "research-agent",
  },
  {
    id: "vol_01HKP4N7Z8",
    slug: "model-weights",
    name: "model-weights",
    sizeGb: 100,
    status: "ATTACHED",
    attachedTo: "model-weights",
  },
  {
    id: "vol_01HKP59ABC",
    slug: "agent-output",
    name: "agent-output",
    sizeGb: 50,
    status: "DETACHED",
  },
  {
    id: "vol_01HKP6DEFG",
    slug: "research-corpus",
    name: "research-corpus",
    sizeGb: 250,
    status: "ATTACHED",
    attachedTo: "research-agent",
  },
  {
    id: "vol_01HKP7HIJK",
    slug: "build-cache",
    name: "build-cache",
    sizeGb: 10,
    status: "DETACHED",
  },
  {
    id: "vol_01HKP8LMNO",
    slug: "scratch",
    name: "scratch",
    sizeGb: 5,
    status: "DELETING",
  },
];
