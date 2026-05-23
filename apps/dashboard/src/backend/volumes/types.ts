export interface RegionSummary {
  id: string;
  name: string;
  country: string;
  continent: string | null;
  provider: string;
  isPaid: boolean;
}

export enum VolumeType {
  Sandbox = "sandbox",
  Web = "web",
  Database = "database",
}

export interface VolumeResponse {
  id: string;
  name: string;
  type: VolumeType;
  team: string | null;
  csiVolumeId: string | null;
  sizeGB: number;
  region: RegionSummary | null;
  attachedSandboxId: string | null;
  attachedProjectId: string | null;
  lastAttachedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateVolumeInput {
  name: string;
  sizeGB: number;
  region: string;
  type?: VolumeType;
  teamId?: string;
}

export interface ListVolumesInput {
  page?: number;
  limit?: number;
  teamId?: string;
}

export interface PaginatedVolumesResponse {
  items: VolumeResponse[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}
