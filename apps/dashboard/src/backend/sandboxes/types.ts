import type { DestroyTimeout, SandboxActivityStatus, SandboxDestroyReason, SandboxStatus, SnapshotMode, SnapshotStatus } from "./enums";

export interface SandboxTemplate {
  name: string;
  displayName: string;
  description: string;
}

export interface SandboxSpecs {
  cpu: number;
  memory: number;
  disk: number;
}

export interface CreateSandboxSpecs {
  cpu?: number;
  memory?: number;
  disk?: number;
}

export interface CreateSandboxInput {
  name?: string;
  region: string;
  template?: string;
  teamId?: string;
  environmentId?: string;
  specs?: CreateSandboxSpecs;
  autoDestroy?: boolean;
  destroyTimeout?: DestroyTimeout;
  oneShot?: boolean;
  blockOutbound?: boolean;
  persistent?: boolean;
  persistentDiskGB?: number;
  volumeId?: string;
  mountPath?: string;
  fromSnapshot?: string;
  snapshotMode?: SnapshotMode;
  snapshotFrequency?: string;
}

export interface CreateSandboxResponse {
  id: string;
  template: string;
  status: SandboxStatus;
  createdAt: string;
  expiresAt: string | null;
}

export interface SandboxResponse {
  id: string;
  name: string;
  template: string;
  status: SandboxStatus;
  region: string;
  regionName: string | null;
  regionCountry: string | null;
  specs: SandboxSpecs;
  teamId: string | null;
  projectEnvironmentId: string | null;
  autoDestroy: boolean;
  destroyTimeout: DestroyTimeout | null;
  oneShot: boolean;
  blockOutbound: boolean;
  persistent: boolean;
  persistentDiskGB: number | null;
  pausedAt: string | null;
  fromSnapshot: string | null;
  snapshotMode: SnapshotMode;
  snapshotFrequency: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  destroyedAt: string | null;
  destroyReason: SandboxDestroyReason | null;
}

export interface ListSandboxesInput {
  page?: number;
  limit?: number;
  teamId?: string;
}

export interface PaginatedSandboxesResponse {
  items: SandboxResponse[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

export interface SnapshotResponse {
  id: string;
  sandboxId: string;
  name: string;
  imageTag: string;
  sourceTemplate: string;
  status: SnapshotStatus;
  failureReason: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface ListSnapshotsInput {
  page?: number;
  limit?: number;
  teamId?: string;
}

export interface CreateSnapshotInput {
  name: string;
}

export interface SandboxActivityResponse {
  id: string;
  command: string;
  status: SandboxActivityStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  error: string | null;
}

export interface ListSandboxActivityInput {
  page?: number;
  limit?: number;
  since?: string;
  until?: string;
  teamId?: string;
}

export interface PaginatedSandboxActivityResponse {
  items: SandboxActivityResponse[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

export interface PaginatedSnapshotsResponse {
  items: SnapshotResponse[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}
