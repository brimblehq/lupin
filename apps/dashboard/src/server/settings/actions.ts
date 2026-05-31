import { createServerFn } from "@tanstack/react-start";
import type { BackendApi } from "@/backend";
import type {
  GitProvider,
  SettingsSidebarSnapshot,
  TestWebhookInput,
  UpdateSettingsBuildsInput,
  UpdateSettingsNotificationsInput,
  UpdateSettingsProfileInput,
  UpdateSettingsThemeInput,
  UpdateSettingsWebhooksInput,
} from "@/backend/settings";
import { withTokenRefresh } from "@/server/shared/backend";

async function resolveWorkspaceSubscriptionId(backend: BackendApi, workspace?: string) {
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

async function resolveWorkspaceTeamId(backend: BackendApi, workspace?: string) {
  const workspaceSlug = workspace?.trim().toLowerCase();
  if (!workspaceSlug) {
    return undefined;
  }

  try {
    const teams = await backend.workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    return match?.id?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export const getSettingsSidebarSnapshotServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  return withTokenRefresh(async (api) => {
    const subscriptionId = await resolveWorkspaceSubscriptionId(api, payload?.workspace);
    const snapshot = await api.settings.getSidebarSnapshot(1, { subscriptionId });
    return snapshot satisfies SettingsSidebarSnapshot;
  });
});

export const listSettingsInvoicesServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as { page?: number; workspace?: string } | undefined;
  let page = 1;

  if (typeof payload?.page === "number") {
    page = Math.max(1, Math.floor(payload.page));
  }

  return withTokenRefresh(async (api) => {
    const subscriptionId = await resolveWorkspaceSubscriptionId(api, payload?.workspace);
    return api.settings.getInvoices(page, { subscriptionId });
  });
});

export const updateSettingsProfileServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSettingsProfileInput;
  return withTokenRefresh((api) => api.settings.updateProfile(input));
});

export const updateSettingsThemeServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSettingsThemeInput;
  return withTokenRefresh(async (api) => {
    await api.settings.updateTheme(input);
    return { ok: true } as const;
  });
});

export const requestSettingsEmailVerificationServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { email: string };
  return withTokenRefresh(async (api) => {
    await api.settings.requestEmailVerification(input.email);
    return { ok: true } as const;
  });
});

export const updateSettingsNotificationsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSettingsNotificationsInput;
  return withTokenRefresh(async (api) => {
    await api.settings.updateNotifications(input);
    return { ok: true } as const;
  });
});

export const updateSettingsBuildsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as unknown as UpdateSettingsBuildsInput & { workspace?: string };
  return withTokenRefresh(async (api) => {
    const teamId = await resolveWorkspaceTeamId(api, payload.workspace);
    await api.settings.updateBuilds({
      buildDisabled: payload.buildDisabled,
      ...(teamId ? { teamId } : {}),
    });
    return { ok: true } as const;
  });
});

export const updateSettingsHapticsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as unknown as { haptics: boolean };
  return withTokenRefresh(async (api) => {
    await api.settings.updateHaptics({ haptics: payload.haptics });
    return { ok: true } as const;
  });
});

export const updateSettingsFollowedXServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as unknown as { followed_x: boolean };
  return withTokenRefresh(async (api) => {
    await api.settings.updateFollowedX({ followed_x: payload.followed_x });
    return { ok: true } as const;
  });
});

export const createSettingsApiKeyServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  return withTokenRefresh((api) => api.settings.createApiKey());
});

export const resetSettingsApiKeyServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  return withTokenRefresh((api) => api.settings.resetApiKey());
});

export const decryptSettingsApiKeyServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { encryptedApiKey: string };
  return withTokenRefresh((api) => api.settings.decryptApiKey(input));
});

export const testSettingsWebhookServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as TestWebhookInput;
  return withTokenRefresh(async (api) => {
    await api.settings.testWebhook(input);
    return { ok: true } as const;
  });
});

export const updateSettingsWebhooksServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSettingsWebhooksInput;
  return withTokenRefresh((api) => api.settings.updateWebhooks(input));
});

export const disconnectGitProviderServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { provider: GitProvider };
  return withTokenRefresh(async (api) => {
    await api.settings.disconnectGitProvider(input.provider);
    return { ok: true } as const;
  });
});
