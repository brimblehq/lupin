import * as Yup from "yup";
import config from "@/config";
import type { ApiClient, ApiListResponse } from "./types";
import { notImplemented } from "./utils";
import { asNonEmptyString, asRecord, asString, pickBoolean, pickNonEmptyString, pickNumber, pickString } from "./normalize";

export interface Project {
  id: string;
  name: string;
  slug: string;
  projectEnvironmentId?: string | null;
  inheritEnvironmentVars?: boolean;
  logId?: string;
  screenshot?: string;
  framework?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  region?: string;
  serviceType?: string;
  authEnabled?: boolean;
  buildCacheEnabled?: boolean;
  hasUpdates?: boolean;
  maintenance?: boolean;
  passwordEnabled?: boolean;
  isPublicAccess?: boolean;
  connectionUri?: string;
  domain?: string;
  previewUrl?: string;
  gitLink?: string;
  statusCode?: number;
  healthCheckPath?: string;
  preStartCommand?: string;
  rootDirectory?: string;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  outputDirectory?: string;
  watchPaths?: string[];
  diskSize?: number;
  volumeMount?: string;
  whiteListedIps?: string[];
  autoscalingGroup?: {
    id?: string;
    name?: string;
    [key: string]: unknown;
  } | null;
  dbImage?: {
    id?: string;
    name?: string;
    [key: string]: unknown;
  } | null;
  backupUrl?: string;
  backupSize?: number;
  lastBackup?: string;
  specs?: {
    memory?: number | string;
    cpu?: number | string;
    storage?: number | string;
    region?: {
      id?: string;
      _id?: string;
      name?: string;
      country?: string;
      continent?: string;
      provider?: string;
      [key: string]: unknown;
    } | null;
  };
  domains?: Array<{
    id?: string;
    name: string;
    isDefault?: boolean;
    createdAt?: string;
    status?: string;
  }>;
  repo?: {
    name?: string;
    fullName?: string;
    branch?: string;
    git?: string;
    installationId?: number | string;
  };
  log?: {
    id?: string;
    message?: string;
  };
  tags?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  job?: {
    commonContainer?: string;
  };
}

export interface ListProjectsInput {
  q?: string;
  serviceType?: string;
  status?: string;
  environmentId?: string;
  useEnvironmentHeader?: boolean;
  sort?: string;
  teamId?: string;
  page?: number;
  limit?: number;
}

export interface CreateProjectInput {
  name?: string;
  teamId?: string;
  [key: string]: unknown;
}

export interface ValidateDockerImageInput {
  imageUri: string;
  credentials?: {
    username: string;
    token: string;
  };
}

export interface DatabaseEngineOption {
  id: string;
  name: string;
  imageUrl?: string;
  image?: string;
  version?: string;
  envs: Array<{ type?: string; value: string }>;
  isAvailable: boolean;
  isDefault: boolean;
  free: boolean;
  hasPort?: boolean;
  port?: number;
  volumePath?: string;
  protocol?: string;
  recommendations: Array<{
    compute?: {
      memory?: number;
      cpu?: number;
      storage?: number;
    };
  }>;
}

export interface CreateDatabaseProjectInput {
  name: string;
  dbImage: string;
  teamId?: string;
  configurations: {
    cpu: number;
    memory: number;
    storage: number;
    region: string;
  };
  whitelistedIps?: string[];
  environments?: Array<{
    name: string;
    value: string;
  }>;
}

export interface DatabaseProvisionResult {
  name: string;
  url?: string;
  message?: string;
}

export interface UpdateProjectInput {
  name?: string;
  framework?: string;
  rootDirectory?: string;
}

export type DebugConfidence = "high" | "medium" | "low";
export type DebugPriority = "high" | "medium" | "low";

export interface DebugLikelyCause {
  title: string;
  confidence: DebugConfidence;
  reason: string;
}

export interface DebugAction {
  title: string;
  priority: DebugPriority;
  why: string;
  steps: string[];
  commands: string[];
  files: string[];
  expectedResult: string;
}

export interface DebugSuggestions {
  summary: string;
  likelyCauses: DebugLikelyCause[];
  actions: DebugAction[];
  quickChecks: string[];
  notes: string[];
}

export interface DebugUsage {
  count: number;
  limit: number;
  limited: boolean;
}

export interface DebugSuggestionsResponse {
  model: string;
  framework: unknown;
  envNames: string[];
  rootDir: unknown[];
  usage: DebugUsage;
  suggestions: DebugSuggestions;
}

export type DebugPrStatus = "created" | "queued" | "blocked";
export type DebugPrBlockReason = "plan_disabled" | "quota_exceeded" | "unsupported_provider" | "no_safe_changes" | "generation_failed";

export interface ProvidedDebugContext {
  framework: unknown | null;
  envNames: string[];
  rootDir: unknown[];
  suggestions: DebugSuggestions;
}

export interface DebugPrUsage {
  count: number;
  limit: number;
  limited: boolean;
  reason: "plan_disabled" | "quota_exceeded" | null;
}

export interface DebugPullRequest {
  url: string;
  number: number;
  title: string;
  baseBranch: string;
  headBranch: string;
  changedFiles: string[];
}

export interface DebugPrJob {
  id: string;
  deduped: boolean;
}

export interface DebugSuggestionsPrResponse {
  model: string;
  status: DebugPrStatus;
  reason: DebugPrBlockReason | null;
  message: string;
  usage: DebugPrUsage;
  debug: {
    framework: unknown | null;
    envNames: string[];
    rootDir: unknown[];
    suggestions: DebugSuggestions;
  } | null;
  pullRequest: DebugPullRequest | null;
  job?: DebugPrJob | null;
}

export interface ProjectsApi {
  list(input?: ListProjectsInput): Promise<PaginatedProjectsResponse>;
  getById(projectId: string, input?: { teamId?: string }): Promise<Project>;
  getScreenshot(projectId: string): Promise<string | null>;
  redeploy(
    projectId: string,
    input?: {
      logId?: string;
      startOnly?: boolean;
      teamId?: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<{ id?: string; message?: string }>;
  debugSuggestions(projectId: string, input: { logId: string; messageId: string; message: string }): Promise<DebugSuggestionsResponse>;
  debugSuggestionsPr(
    projectId: string,
    input: { logId: string; messageId: string; message: string; debug?: ProvidedDebugContext | null },
  ): Promise<DebugSuggestionsPrResponse>;
  transfer(projectId: string, input: { teamId: string }): Promise<{ id?: string; team?: string; environmentId?: string }>;
  databaseBackup(projectId: string, input?: { teamId?: string }): Promise<{ message?: string }>;
  databaseRefresh(projectId: string, input?: { teamId?: string }): Promise<{ message?: string }>;
  updateDatabaseConfig(
    projectId: string,
    input: {
      name: string;
      password: string;
      configurations?: Record<string, unknown> | null;
      whitelistedIps?: string[];
      teamId?: string;
    },
  ): Promise<{ message?: string }>;
  create(input: CreateProjectInput): Promise<Project>;
  validateDockerImage(input: ValidateDockerImageInput): Promise<boolean>;
  listAvailableDatabases(): Promise<DatabaseEngineOption[]>;
  createDatabase(input: CreateDatabaseProjectInput): Promise<DatabaseProvisionResult>;
  update(projectId: string, input: UpdateProjectInput): Promise<Project>;
  updateEnvironment(
    projectId: string,
    input: { environmentId: string; inheritEnvVars?: boolean; teamId?: string },
  ): Promise<{ id: string; environmentId: string; inheritEnvVars: boolean }>;
  remove(projectId: string, input?: { teamId?: string }): Promise<void>;
  linkRepo(
    projectId: string,
    input: {
      repo: { name: string; installationId: number | string; git: string };
      teamId?: string;
    },
  ): Promise<{ message?: string }>;
  unlinkRepo(projectId: string, input?: { teamId?: string }): Promise<{ message?: string }>;
  setPasswordProtection(
    projectId: string,
    input: { teamId?: string; passwordEnabled: boolean; password?: string },
  ): Promise<{ id: string; passwordEnabled: boolean }>;
}

export interface PaginatedProjectsResponse extends ApiListResponse<Project> {
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  overallTotalProjects?: number;
}

const debugMessageSchema = Yup.object({
  logId: Yup.string().trim().required("Log ID is required"),
  messageId: Yup.string().trim().required("Message ID is required"),
  message: Yup.string()
    .trim()
    .required("We need the log message to debug.")
    .min(5, "This log line is too short to debug.")
    .max(5000, "This log line is too long for quick fix."),
});

function mapStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => asString(item) ?? "").filter((item) => item.length > 0) : [];
}

function mapDebugConfidence(value: unknown): DebugConfidence {
  const v = String(value ?? "").toLowerCase();
  return v === "high" || v === "medium" || v === "low" ? (v as DebugConfidence) : "low";
}

function mapDebugPriority(value: unknown): DebugPriority {
  const v = String(value ?? "").toLowerCase();
  return v === "high" || v === "medium" || v === "low" ? (v as DebugPriority) : "low";
}

function mapDebugSuggestionsObject(record: Record<string, unknown>): DebugSuggestions {
  const likelyCauses: DebugLikelyCause[] = Array.isArray(record.likelyCauses)
    ? record.likelyCauses
        .map((item: unknown) => {
          const row = asRecord(item) ?? {};
          const title = pickString(row, "title") ?? "";
          if (!title) return null;
          return {
            title,
            confidence: mapDebugConfidence(row.confidence),
            reason: pickString(row, "reason") ?? "",
          } satisfies DebugLikelyCause;
        })
        .filter((item: DebugLikelyCause | null): item is DebugLikelyCause => item !== null)
    : [];

  const actions: DebugAction[] = Array.isArray(record.actions)
    ? record.actions
        .map((item: unknown) => {
          const row = asRecord(item) ?? {};
          const title = pickString(row, "title") ?? "";
          if (!title) return null;
          return {
            title,
            priority: mapDebugPriority(row.priority),
            why: pickString(row, "why") ?? "",
            steps: mapStringArray(row.steps),
            commands: mapStringArray(row.commands),
            files: mapStringArray(row.files),
            expectedResult: pickString(row, "expectedResult") ?? "",
          } satisfies DebugAction;
        })
        .filter((item: DebugAction | null): item is DebugAction => item !== null)
    : [];

  return {
    summary: pickString(record, "summary") ?? "",
    likelyCauses,
    actions,
    quickChecks: mapStringArray(record.quickChecks),
    notes: mapStringArray(record.notes),
  };
}

export function createProjectsApi(client: ApiClient): ProjectsApi {
  const listEndpoint = "/core/v1/projects";

  function mapProject(project: any): Project {
    const row = asRecord(project) ?? {};
    const repoRecord = asRecord(row.repo);
    const specsRecord = asRecord(row.specs);
    const specsRegionRecord = asRecord(specsRecord?.region);

    let region: string | undefined;
    const regionSource = specsRecord?.region ?? row.region;
    if (typeof regionSource === "string") {
      region = regionSource;
    } else {
      const regionRecord = asRecord(regionSource);
      const regionName = pickNonEmptyString(regionRecord, "name") ?? "";
      const regionCountry = pickNonEmptyString(regionRecord, "country") ?? "";

      if (regionName && regionCountry) {
        region = `${regionName} (${regionCountry})`;
      } else if (regionName) {
        region = regionName;
      } else if (regionCountry) {
        region = regionCountry;
      }
    }

    const passwordEnabled = pickBoolean(row, "passwordEnabled", "password_enabled");
    const domain = pickNonEmptyString(row, "domain");
    const previewUrl = pickString(row, "previewUrl", "url");
    const gitLink = pickNonEmptyString(row, "gitLink") ?? pickNonEmptyString(repoRecord, "url", "html_url");
    const statusCode = pickNumber(row, "statusCode", "status_code");
    const connectionUri = pickNonEmptyString(row, "connectionUri", "connection_uri");

    let domains: Project["domains"];
    if (Array.isArray(row.domains)) {
      domains = row.domains
        .filter((domain: any) => domain?.name)
        .map((domain: any) => {
          const domainRecord = asRecord(domain) ?? {};
          const isDefault = pickBoolean(domainRecord, "default", "isDefault");

          return {
            id: pickString(domainRecord, "id", "_id"),
            name: String(domainRecord.name),
            isDefault,
            createdAt: asString(domainRecord.createdAt),
            status: asString(domainRecord.status),
          };
        });
    }

    let whiteListedIps: string[] | undefined;
    if (Array.isArray(row.whiteListedIps)) {
      whiteListedIps = row.whiteListedIps.filter((ip: unknown) => typeof ip === "string").map((ip: string) => ip);
    }

    let watchPaths: string[] | undefined;
    if (Array.isArray(row.watchPaths)) {
      watchPaths = row.watchPaths
        .filter((path: unknown): path is string => typeof path === "string" && path.trim().length > 0)
        .map((path: string) => path);
    }

    let autoscalingGroup: Project["autoscalingGroup"] = null;
    if (row.autoscalingGroup && typeof row.autoscalingGroup === "object") {
      const autoscalingGroupRecord = asRecord(row.autoscalingGroup) ?? {};
      autoscalingGroup = {
        ...autoscalingGroupRecord,
        id: pickString(autoscalingGroupRecord, "_id", "id"),
        name: asString(autoscalingGroupRecord.name),
      };
    }

    let dbImage: Project["dbImage"] = null;
    if (row.dbImage && typeof row.dbImage === "object") {
      const dbImageRecord = asRecord(row.dbImage) ?? {};
      dbImage = {
        ...dbImageRecord,
        id: pickString(dbImageRecord, "_id", "id"),
        name: asString(dbImageRecord.name),
      };
    }

    const authEnabled = pickBoolean(row, "authEnabled");
    const buildCacheEnabled = pickBoolean(row, "buildCacheEnabled");
    const hasUpdates = pickBoolean(row, "hasUpdates");
    const maintenance = pickBoolean(row, "maintenance");
    const isPublicAccess = pickBoolean(row, "isPublicAccess", "publicAccess");

    let specsRegion: NonNullable<Project["specs"]>["region"] = null;
    if (specsRegionRecord) {
      specsRegion = {
        ...specsRegionRecord,
        id: pickString(specsRegionRecord, "_id", "id"),
      };
    }

    const rootDirectory = pickString(row, "rootDirectory", "rootDir");

    let job: Project["job"] | undefined;
    if (project?.job && typeof project.job === "object") {
      job = {
        commonContainer: typeof project.job.commonContainer === "string" ? project.job.commonContainer : undefined,
      };
    }

    let tags: Project["tags"];
    if (Array.isArray(row.tags)) {
      tags = row.tags
        .filter((t: any) => t && (t._id || t.id) && t.name)
        .map((t: any) => ({
          id: String(t._id ?? t.id),
          name: String(t.name),
          color: String(t.color ?? "#6366f1"),
        }));
    }

    return {
      id: String(row.id ?? row._id ?? row.name ?? ""),
      name: String(row.name ?? ""),
      slug: String(row.slug ?? row.name ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-"),
      projectEnvironmentId: pickString(row, "projectEnvironmentId", "project_environment_id", "environmentId", "environment_id") ?? null,
      inheritEnvironmentVars: pickBoolean(row, "inheritEnvironmentVars", "inherit_environment_vars", "inheritEnvVars") ?? undefined,
      logId: pickString(row, "logId", "logID"),
      screenshot: pickNonEmptyString(row, "screenshot"),
      framework: asString(row.framework),
      createdAt: asString(row.createdAt),
      updatedAt: asString(row.updatedAt),
      status: asString(row.status),
      region,
      serviceType: asString(row.serviceType) ?? asString(row.service_type) ?? asString(row.type),
      authEnabled,
      buildCacheEnabled,
      hasUpdates,
      maintenance,
      passwordEnabled,
      isPublicAccess,
      connectionUri,
      domain,
      previewUrl,
      gitLink,
      statusCode,
      healthCheckPath: pickString(row, "healthCheckPath"),
      preStartCommand: pickString(row, "preStartCommand"),
      rootDirectory,
      installCommand: pickString(row, "installCommand"),
      buildCommand: pickString(row, "buildCommand"),
      startCommand: pickString(row, "startCommand"),
      outputDirectory: pickString(row, "outputDirectory"),
      watchPaths,
      diskSize: pickNumber(row, "diskSize"),
      volumeMount: pickString(row, "volumeMount"),
      whiteListedIps,
      autoscalingGroup,
      dbImage,
      backupUrl: pickString(row, "backupUrl", "backup_url", "last_backup_url"),
      backupSize: pickNumber(row, "backupSize", "backup_size"),
      lastBackup: pickString(row, "lastBackup", "last_backup"),
      specs: specsRecord
        ? {
            memory: specsRecord.memory as number | string | undefined,
            cpu: specsRecord.cpu as number | string | undefined,
            storage: specsRecord.storage as number | string | undefined,
            region: specsRegion,
          }
        : undefined,
      domains,
      repo: repoRecord
        ? {
            name: asString(repoRecord.name),
            fullName: pickString(repoRecord, "full_name", "fullName"),
            branch: asString(repoRecord.branch),
            git: asString(repoRecord.git),
            installationId:
              typeof repoRecord.installationId === "string" || typeof repoRecord.installationId === "number"
                ? repoRecord.installationId
                : undefined,
          }
        : undefined,
      tags,
      log: asRecord(row.log)
        ? { id: asString(asRecord(row.log)?.id) || asString(asRecord(row.log)?._id), message: asString(asRecord(row.log)?.message) }
        : undefined,
      job,
    };
  }

  return {
    async list(input) {
      const environmentId = input?.environmentId?.trim() || undefined;
      const response = await client.request<any>(listEndpoint, {
        method: "GET",
        headers: input?.useEnvironmentHeader && environmentId ? { "x-brimble-environment": environmentId } : undefined,
        query: {
          q: input?.q,
          serviceType: input?.serviceType,
          status: input?.status,
          environmentId,
          sort: input?.sort ?? "updatedAt",
          teamId: input?.teamId,
          page: input?.page,
          limit: input?.limit,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawProjects = Array.isArray(root?.projects) ? root.projects : Array.isArray(root) ? root : [];

      const rootRecord = asRecord(root);
      const total = pickNumber(rootRecord, "total", "count", "overallTotalProjects") ?? rawProjects.length;

      let currentPage = 1;
      if (pickNumber(rootRecord, "currentPage") !== undefined) {
        currentPage = pickNumber(rootRecord, "currentPage")!;
      } else if (typeof input?.page === "number" && input.page > 0) {
        currentPage = input.page;
      }

      let totalPages = 1;
      if (pickNumber(rootRecord, "totalPages") !== undefined) {
        totalPages = pickNumber(rootRecord, "totalPages")!;
      } else {
        const pageSize = pickNumber(rootRecord, "limit") ?? input?.limit;
        if (typeof pageSize === "number" && pageSize > 0) {
          totalPages = Math.max(1, Math.ceil(total / pageSize));
        }
      }

      return {
        items: rawProjects.map((project: any) => mapProject(project)),
        total,
        currentPage,
        totalPages,
        pageSize: pickNumber(rootRecord, "limit") ?? (typeof input?.limit === "number" ? input.limit : undefined),
        overallTotalProjects: pickNumber(rootRecord, "overallTotalProjects"),
      } satisfies PaginatedProjectsResponse;
    },
    async getById(projectId, input) {
      const response = await client.request<any>(`${listEndpoint}/${encodeURIComponent(projectId)}`, {
        method: "GET",
        query: {
          teamId: input?.teamId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      return mapProject(root);
    },
    async getScreenshot(projectId) {
      const response = await client.request<any>(`${listEndpoint}/${encodeURIComponent(projectId)}/screenshot`, {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? null;
      const rootRecord = asRecord(root);

      const screenshotUrl = asNonEmptyString(root) ?? pickNonEmptyString(rootRecord, "screenshot", "url");
      if (screenshotUrl) {
        return screenshotUrl;
      }

      return null;
    },
    async redeploy(projectId, input) {
      const response = await client.request<any>(`${listEndpoint}/${encodeURIComponent(projectId)}/redeploy`, {
        method: "POST",
        body: {
          ...(input?.payload || {}),
          logId: input?.logId,
          startOnly: input?.startOnly,
        },
        query: { teamId: input?.teamId },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root);

      return {
        id: pickString(rootRecord, "id", "_id"),
        message: pickString(rootRecord, "message"),
      };
    },
    async debugSuggestions(projectId, input) {
      const { logId, messageId, message } = debugMessageSchema.validateSync(input);

      const path = `${listEndpoint}/${encodeURIComponent(projectId)}/debug-suggestions`;
      const requestBody = { logId, messageId, message, debugModel: config.aiDebugModel };

      const response = await client.request<any>(path, {
        method: "POST",
        body: requestBody,
        timeout: 90_000,
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root) ?? {};
      const usageRecord = asRecord(rootRecord.usage) ?? {};

      const usage: DebugUsage = {
        count: pickNumber(usageRecord, "count") ?? 0,
        limit: pickNumber(usageRecord, "limit") ?? 0,
        limited: pickBoolean(usageRecord, "limited") ?? false,
      };

      return {
        model: pickString(rootRecord, "model") ?? "",
        framework: rootRecord.framework ?? null,
        envNames: mapStringArray(rootRecord.envNames),
        rootDir: Array.isArray(rootRecord.rootDir) ? rootRecord.rootDir : [],
        usage,
        suggestions: mapDebugSuggestionsObject(asRecord(rootRecord.suggestions) ?? {}),
      } satisfies DebugSuggestionsResponse;
    },
    async debugSuggestionsPr(projectId, input) {
      const { logId, messageId, message } = debugMessageSchema.validateSync({
        logId: input.logId,
        messageId: input.messageId,
        message: input.message,
      });

      const body: Record<string, unknown> = { logId, messageId, message, debugModel: config.aiDebugModel };
      if (input.debug) {
        body.debug = input.debug;
      }

      const path = `${listEndpoint}/${encodeURIComponent(projectId)}/debug-suggestions/pr`;

      const response = await client.request<any>(path, {
        method: "POST",
        body,
        timeout: 180_000,
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root) ?? {};
      const usageRecord = asRecord(rootRecord.usage) ?? {};
      const debugRecord = asRecord(rootRecord.debug);
      const pullRequestRecord = asRecord(rootRecord.pullRequest);
      const jobRecord = asRecord(rootRecord.job);

      const statusRaw = String(rootRecord.status ?? "").toLowerCase();
      let status: DebugPrStatus = "blocked";
      if (statusRaw === "created") {
        status = "created";
      } else if (statusRaw === "queued") {
        status = "queued";
      }

      const reasonRaw = String(rootRecord.reason ?? "").toLowerCase();
      const allowedReasons: DebugPrBlockReason[] = [
        "plan_disabled",
        "quota_exceeded",
        "unsupported_provider",
        "no_safe_changes",
        "generation_failed",
      ];
      const reason = allowedReasons.find((r) => r === reasonRaw) ?? null;

      const usageReasonRaw = String(usageRecord.reason ?? "").toLowerCase();
      const usageReason: DebugPrUsage["reason"] =
        usageReasonRaw === "plan_disabled" || usageReasonRaw === "quota_exceeded" ? usageReasonRaw : null;

      const usage: DebugPrUsage = {
        count: pickNumber(usageRecord, "count") ?? 0,
        limit: pickNumber(usageRecord, "limit") ?? 0,
        limited: pickBoolean(usageRecord, "limited") ?? false,
        reason: usageReason,
      };

      const pullRequest: DebugPullRequest | null = pullRequestRecord
        ? {
            url: pickString(pullRequestRecord, "url") ?? "",
            number: pickNumber(pullRequestRecord, "number") ?? 0,
            title: pickString(pullRequestRecord, "title") ?? "",
            baseBranch: pickString(pullRequestRecord, "baseBranch") ?? "",
            headBranch: pickString(pullRequestRecord, "headBranch") ?? "",
            changedFiles: mapStringArray(pullRequestRecord.changedFiles),
          }
        : null;

      const job: DebugPrJob | null = jobRecord
        ? {
            id: pickString(jobRecord, "id") ?? "",
            deduped: pickBoolean(jobRecord, "deduped") ?? false,
          }
        : null;

      return {
        model: pickString(rootRecord, "model") ?? "",
        status,
        reason,
        message: pickString(rootRecord, "message") ?? "",
        usage,
        debug: debugRecord
          ? {
              framework: debugRecord.framework ?? null,
              envNames: mapStringArray(debugRecord.envNames),
              rootDir: Array.isArray(debugRecord.rootDir) ? debugRecord.rootDir : [],
              suggestions: mapDebugSuggestionsObject(asRecord(debugRecord.suggestions) ?? {}),
            }
          : null,
        pullRequest,
        job,
      } satisfies DebugSuggestionsPrResponse;
    },
    async transfer(projectId, input) {
      const teamId = input.teamId.trim();
      if (!teamId) {
        throw new Error("Team ID is required");
      }

      const response = await client.request<any>(`${listEndpoint}/transfer/${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: { teamId },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root) ?? {};

      return {
        id: pickString(rootRecord, "id", "_id"),
        team: pickString(rootRecord, "team"),
        environmentId: pickString(rootRecord, "project_environment", "projectEnvironment", "environmentId"),
      };
    },
    async databaseBackup(projectId, input) {
      const response = await client.request<any>("/core/v1/projects/database/backup", {
        method: "POST",
        query: {
          teamId: input?.teamId,
        },
        body: {
          projectId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root);
      return {
        message: pickString(rootRecord, "message"),
      };
    },
    async databaseRefresh(projectId, input) {
      const response = await client.request<any>("/core/v1/projects/database/refresh", {
        method: "POST",
        query: {
          teamId: input?.teamId,
        },
        body: {
          projectId,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root);
      return {
        message: pickString(rootRecord, "message"),
      };
    },
    async updateDatabaseConfig(projectId, input) {
      const response = await client.request<any>(`/core/v1/projects/database/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        query: {
          teamId: input?.teamId,
        },
        body: {
          name: input.name,
          password: input.password,
          configurations: input.configurations ?? null,
          whitelistedIps: input.whitelistedIps ?? [],
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root);
      return {
        message: pickString(rootRecord, "message"),
      };
    },
    async create(input) {
      const body = { ...(input as Record<string, unknown>) };
      let teamId: string | undefined;
      if (typeof body.teamId === "string" && body.teamId.trim()) {
        teamId = body.teamId.trim();
        body.teamId = teamId;
      }

      const response = await client.request<any>(listEndpoint, {
        method: "POST",
        body,
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      return mapProject(root);
    },
    async validateDockerImage(input) {
      const imageUri = input?.imageUri?.trim();
      if (!imageUri) {
        throw new Error("Docker image is required");
      }

      const response = await client.request<any>("/core/v1/projects/validate-image", {
        method: "POST",
        body: {
          image_uri: imageUri,
          ...(input.credentials?.username?.trim() && input.credentials?.token?.trim()
            ? {
                credentials: {
                  username: input.credentials.username.trim(),
                  token: input.credentials.token.trim(),
                },
              }
            : {}),
        },
      });

      const root = response?.data?.data ?? response?.data ?? response;
      if (typeof root === "boolean") {
        return root;
      }

      const rootRecord = asRecord(root);
      const nestedData = asRecord(rootRecord?.data);

      return pickBoolean(rootRecord, "valid", "isValid", "success") ?? pickBoolean(nestedData, "valid", "isValid", "success") ?? false;
    },
    async listAvailableDatabases() {
      const response = await client.request<any>("/core/v1/projects/available-databases", {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const rows = Array.isArray(root) ? root : [];

      return rows
        .map((item) => {
          const row = asRecord(item) ?? {};
          const id = pickNonEmptyString(row, "_id", "id");
          const name = pickNonEmptyString(row, "name");
          if (!id || !name) {
            return null;
          }

          const envs: Array<{ type?: string; value: string }> = Array.isArray(row.envs)
            ? row.envs.flatMap((env) => {
                const envRow = asRecord(env) ?? {};
                const value = pickNonEmptyString(envRow, "value");
                if (!value) return [];
                const type = pickNonEmptyString(envRow, "type");
                return [type !== undefined ? { type, value } : { value }];
              })
            : [];

          const recommendations = Array.isArray(row.recommendations)
            ? row.recommendations.map((rec) => {
                const recRow = asRecord(rec) ?? {};
                const computeRow = asRecord(recRow.compute);
                return {
                  compute: computeRow
                    ? {
                        memory: pickNumber(computeRow, "memory"),
                        cpu: pickNumber(computeRow, "cpu"),
                        storage: pickNumber(computeRow, "storage"),
                      }
                    : undefined,
                };
              })
            : [];

          const option: DatabaseEngineOption = {
            id,
            name,
            imageUrl: pickString(row, "image_url", "imageUrl"),
            image: pickString(row, "image"),
            version: pickString(row, "version"),
            envs,
            isAvailable: pickBoolean(row, "is_available", "isAvailable") ?? true,
            isDefault: pickBoolean(row, "is_default", "isDefault") ?? false,
            free: pickBoolean(row, "free") ?? false,
            hasPort: pickBoolean(row, "hasPort", "has_port"),
            port: pickNumber(row, "port"),
            volumePath: pickString(row, "volumePath", "volume_path"),
            protocol: pickString(row, "protocol"),
            recommendations,
          };
          return option;
        })
        .filter((item: DatabaseEngineOption | null): item is DatabaseEngineOption => item !== null);
    },
    async createDatabase(input) {
      const response = await client.request<any>("/core/v1/projects/database", {
        method: "POST",
        body: {
          name: input.name,
          dbImage: input.dbImage,
          teamId: input.teamId,
          configurations: input.configurations,
          whitelistedIps: input.whitelistedIps ?? [],
          environments: input.environments ?? [],
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root) ?? {};
      return {
        name: pickString(rootRecord, "name") ?? input.name,
        url: pickString(rootRecord, "url"),
        message: pickString(rootRecord, "message"),
      };
    },
    async updateEnvironment(projectId, input) {
      const response = await client.request<any>(`${listEndpoint}/${encodeURIComponent(projectId)}/environment`, {
        method: "PATCH",
        query: {
          teamId: input.teamId,
        },
        body: {
          environmentId: input.environmentId,
          inheritEnvVars: input.inheritEnvVars,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rootRecord = asRecord(root) ?? {};

      return {
        id: pickString(rootRecord, "id", "_id") ?? projectId,
        environmentId: pickString(rootRecord, "environmentId", "environment_id") ?? input.environmentId,
        inheritEnvVars: pickBoolean(rootRecord, "inheritEnvVars", "inherit_environment_vars") ?? Boolean(input.inheritEnvVars),
      };
    },
    update: () => notImplemented<Project>("projects", "update"),
    async remove(projectId, _input) {
      await client.request<any>(`${listEndpoint}/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
    },
    async linkRepo(projectId, input) {
      const response = await client.request<any>(`${listEndpoint}/link/${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: { type: "repo", repo: input.repo },
        query: { teamId: input.teamId },
      });
      const root = response?.data?.data ?? response?.data ?? response ?? {};
      return { message: pickString(asRecord(root), "message") };
    },
    async unlinkRepo(projectId, input) {
      const response = await client.request<any>(`${listEndpoint}/unlink/${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: { type: "repo" },
        query: { teamId: input?.teamId },
      });
      const root = response?.data?.data ?? response?.data ?? response ?? {};
      return { message: pickString(asRecord(root), "message") };
    },
    async setPasswordProtection(projectId, input) {
      const body: Record<string, unknown> = { passwordEnabled: input.passwordEnabled };
      if (input.teamId) body.teamId = input.teamId;
      if (input.passwordEnabled && input.password) body.password = input.password;

      const response = await client.request<any>(`${listEndpoint}/password-protect/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        body,
      });

      const data = response?.data?.data ?? response?.data;
      return {
        id: data.id as string,
        passwordEnabled: data.passwordEnabled as boolean,
      };
    },
  };
}
