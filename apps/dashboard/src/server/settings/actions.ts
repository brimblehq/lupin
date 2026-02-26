import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type {
  GitProvider,
  InitializeSettingsAddCardInput,
  SettingsSidebarSnapshot,
  TestWebhookInput,
  UpdateSettingsBuildsInput,
  UpdateSettingsNotificationsInput,
  UpdateSettingsProfileInput,
  UpdateSettingsWebhooksInput,
} from "@/backend/settings";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

async function resolveWorkspaceSubscriptionId(backend: ReturnType<typeof getServerBackendApi>, workspace?: string) {
  const workspaceSlug = workspace?.trim().toLowerCase();
  if (!workspaceSlug) {
    return undefined;
  }

  try {
    const team = await backend.teams.getByName(workspaceSlug);
    return team.subscriptionId?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export const getSettingsSidebarSnapshotServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  const backend = getServerBackendApi();
  const subscriptionId = await resolveWorkspaceSubscriptionId(backend, payload?.workspace);
  const snapshot = await backend.settings.getSidebarSnapshot(1, { subscriptionId });
  return snapshot satisfies SettingsSidebarSnapshot;
});

export const listSettingsInvoicesServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as { page?: number; workspace?: string } | undefined;
  let page = 1;

  if (typeof payload?.page === "number") {
    page = Math.max(1, Math.floor(payload.page));
  }

  const backend = getServerBackendApi();
  const subscriptionId = await resolveWorkspaceSubscriptionId(backend, payload?.workspace);
  return backend.settings.getInvoices(page, { subscriptionId });
});

export const updateSettingsProfileServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSettingsProfileInput;
  return getServerBackendApi().settings.updateProfile(input);
});

export const requestSettingsEmailVerificationServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { email: string };
  await getServerBackendApi().settings.requestEmailVerification(input.email);
  return { ok: true } as const;
});

export const updateSettingsNotificationsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSettingsNotificationsInput;
  await getServerBackendApi().settings.updateNotifications(input);
  return { ok: true } as const;
});

export const updateSettingsBuildsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSettingsBuildsInput;
  await getServerBackendApi().settings.updateBuilds(input);
  return { ok: true } as const;
});

export const createSettingsApiKeyServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  return getServerBackendApi().settings.createApiKey();
});

export const resetSettingsApiKeyServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  return getServerBackendApi().settings.resetApiKey();
});

export const decryptSettingsApiKeyServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { encryptedApiKey: string };
  return getServerBackendApi().settings.decryptApiKey(input);
});

export const testSettingsWebhookServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as TestWebhookInput;
  await getServerBackendApi().settings.testWebhook(input);
  return { ok: true } as const;
});

export const initializeSettingsAddCardServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as InitializeSettingsAddCardInput;
  return getServerBackendApi().settings.initializeAddCard(input);
});

export const updateSettingsWebhooksServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSettingsWebhooksInput;
  return getServerBackendApi().settings.updateWebhooks(input);
});

export const disconnectGitProviderServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { provider: GitProvider };
  await getServerBackendApi().settings.disconnectGitProvider(input.provider);
  return { ok: true } as const;
});
