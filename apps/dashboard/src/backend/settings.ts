import config from "@/config";
import type { ApiClient } from "./types";
import type {
  GitProvider,
  SettingsApi,
  SettingsApiKeyResult,
  SettingsBillingSnapshot,
  DecryptSettingsApiKeyInput,
  SettingsInvoiceItem,
  SettingsInvoicePage,
  SettingsPaymentCard,
  SettingsPaymentProvider,
  SettingsPlan,
  SettingsSidebarSnapshot,
  SettingsSpendingStats,
  SettingsUserProfile,
  SettingsWebhookGroup,
  SettingsWebhookState,
} from "./settings/types";

export type {
  GitProvider,
  SettingsApi,
  SettingsApiKeyResult,
  SettingsBillingSnapshot,
  DecryptSettingsApiKeyInput,
  SettingsInvoiceItem,
  SettingsInvoicePage,
  SettingsPaymentCard,
  SettingsPaymentProvider,
  SettingsPlan,
  SettingsSidebarSnapshot,
  SettingsSpendingStats,
  SettingsUserProfile,
  SettingsWebhookEvent,
  SettingsWebhookGroup,
  SettingsWebhookState,
  TestWebhookInput,
  UpdateSettingsBuildsInput,
  UpdateSettingsNotificationsInput,
  UpdateSettingsProfileInput,
  UpdateSettingsWebhooksInput,
} from "./settings/types";

function unwrapData<T = any>(payload: any): T {
  if (payload?.data?.data !== undefined) {
    return payload.data.data as T;
  }

  if (payload?.data !== undefined) {
    return payload.data as T;
  }

  return payload as T;
}

function mapProfile(payload: any): SettingsUserProfile {
  const data = unwrapData<any>(payload);
  const firstName = String(data?.first_name ?? data?.firstName ?? "");
  const lastName = String(data?.last_name ?? data?.lastName ?? "");
  const username = String(data?.username ?? "");
  const email = String(data?.email ?? "");
  const id = String(data?._id ?? data?.id ?? "");

  return {
    id,
    email,
    username,
    firstName,
    lastName,
    avatarUrl: data?.avatar,
    buildDisabled: Boolean(data?.build_disabled),
    apiKey: data?.api_key,
    notifications: {
      mute: Boolean(data?.notifications?.mute),
      email: Boolean(data?.notifications?.email),
    },
    subscription: data?.subscription
      ? {
          id: data.subscription?._id,
          planType:
            data.subscription?.plan_type !== undefined
              ? String(data.subscription.plan_type)
              : undefined,
          due: Boolean(data.subscription?.due),
        }
      : undefined,
  };
}

function mapWebhookGroups(groups: any[]): SettingsWebhookGroup[] {
  return (groups ?? []).map((group) => ({
    title: String(group?.title ?? ""),
    events: (group?.events ?? []).map((event: any) => ({
      key: String(event?.key ?? ""),
      label: String(event?.label ?? ""),
      description: String(event?.description ?? ""),
      enabled: Boolean(event?.enabled),
    })),
  }));
}

function mapWebhooks(payload: any): SettingsWebhookState {
  const data = unwrapData<any>(payload) ?? {};

  return {
    webhookUrl: String(data?.webhookUrl ?? ""),
    discordUrl: String(data?.discordUrl ?? ""),
    slackUrl: String(data?.slackUrl ?? ""),
    groups: mapWebhookGroups(data?.events ?? []),
  };
}

function mapCards(payload: any): SettingsPaymentCard[] {
  const data = unwrapData<any[]>(payload) ?? [];

  return data.map((card) => ({
    id: String(card?._id ?? card?.id ?? ""),
    cardType: card?.card_type,
    expMonth: card?.exp_month,
    expYear: card?.exp_year,
    last4: card?.last4,
    preferred: Boolean(card?.preferred),
    provider: card?.provider,
  }));
}

function mapProviders(payload: any): SettingsPaymentProvider[] {
  const data = unwrapData<any[]>(payload) ?? [];

  return data.map((provider) => ({
    name: String(provider?.name ?? ""),
    enum: String(provider?.enum ?? ""),
    logo: provider?.logo,
    description: provider?.description,
    features: Array.isArray(provider?.features)
      ? provider.features.map((feature: unknown) => String(feature))
      : [],
  }));
}

function mapSpendingStats(payload: any): SettingsSpendingStats {
  const data = unwrapData<any>(payload) ?? {};
  return {
    used: Number(data?.used ?? 0),
    spendingLimit: Number(data?.spending_limit ?? 0),
  };
}

function mapInvoicePage(payload: any, page: number): SettingsInvoicePage {
  const root =
    (payload?.data && typeof payload.data === "object" ? payload.data : null) ??
    (unwrapData<any>(payload) ?? {});
  const list = Array.isArray(root?.data)
    ? root.data
    : Array.isArray(root)
      ? root
      : [];

  const items: SettingsInvoiceItem[] = list.map((invoice: any) => ({
    id: String(invoice?._id ?? invoice?.id ?? ""),
    createdAt: invoice?.created_at,
    total: Number(invoice?.total ?? 0),
    due: Boolean(invoice?.due),
    description: invoice?.item?.description,
    downloadLink: invoice?.download_link,
  }));

  return {
    page,
    totalPages: Number(root?.total_pages ?? root?.totalPages ?? 1),
    limit: root?.limit !== undefined ? Number(root.limit) : undefined,
    items,
  };
}

function mapPlans(payload: any): SettingsPlan[] {
  const data = unwrapData<Record<string, any>>(payload) ?? {};
  const entries = Object.entries(data);

  return entries.map(([key, plan]) => ({
    key,
    amount: Number(plan?.amount ?? 0),
    tagLine: plan?.tagLine,
    isRecommended: Boolean(plan?.isRecommended),
    features: Array.isArray(plan?.features)
      ? plan.features.map((feature: unknown) => String(feature))
      : [],
  }));
}

function createWebhookTestPayload(type: "webhook" | "discord" | "slack") {
  const basePayload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test notification from Brimble",
      project: "Test Project",
      environment: "production",
      status: "success",
    },
  };

  if (type === "discord") {
    return {
      content: "Brimble Test Notification",
      embeds: [
        {
          title: "Webhook Test",
          description: "This is a test notification from Brimble",
          color: 5814783,
          fields: [
            { name: "Project", value: "Test Project", inline: true },
            { name: "Environment", value: "production", inline: true },
            { name: "Status", value: "Success", inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Brimble Webhook Test",
          },
        },
      ],
    };
  }

  if (type === "slack") {
    return {
      text: "Brimble Test Notification",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Brimble Webhook Test",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "This is a test notification from Brimble",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Project:*\nTest Project",
            },
            {
              type: "mrkdwn",
              text: "*Environment:*\nproduction",
            },
            {
              type: "mrkdwn",
              text: "*Status:*\nSuccess",
            },
          ],
        },
      ],
    };
  }

  return basePayload;
}

export function createSettingsApi(client: ApiClient): SettingsApi {
  const endpoints = {
    authUserMe: `${config.authApiUrl}/user/me`,
    updateUser: `${config.authApiUrl}/user/update`,
    requestEmailVerification: `${config.authApiUrl}/user/update-email`,
    notifications: `${config.authApiUrl}/user/notifications`,
    builds: `${config.authApiUrl}/user/builds`,
    webhooks: "/core/v1/webhooks",
    apiKeyCreate: "/core/v1/api-key/create",
    apiKeyReset: "/core/v1/api-key/reset",
    decrypt: "/core/v1/decrypt",
    paymentCards: `${config.paymentApiUrl}/cards`,
    paymentProviders: `${config.paymentApiUrl}/providers`,
    paymentInitialize: `${config.paymentApiUrl}/payment/initialize/payment`,
    paymentInvoices: `${config.paymentApiUrl}/payment/invoices`,
    paymentStats: `${config.paymentApiUrl}/subscription/stats`,
    paymentPlans: "/core/v1/plans",
    disconnectProvider: `${config.authApiUrl}/user/disconnect`,
  } as const;

  const getBillingSnapshotInternal = async (
    page = 1,
    options?: { subscriptionId?: string },
  ): Promise<SettingsBillingSnapshot> => {
    const subscriptionId = options?.subscriptionId?.trim() || undefined;
    const [cardsResponse, providersResponse, statsResponse, invoicesResponse, plansResponse] =
      await Promise.all([
        client.request(endpoints.paymentCards, { method: "GET" }),
        client.request(endpoints.paymentProviders, { method: "GET" }),
        client.request(endpoints.paymentStats, { method: "GET" }),
        client.request(endpoints.paymentInvoices, {
          method: "GET",
          query: {
            page,
            ...(subscriptionId ? { subscriptionId } : {}),
          },
        }),
        client.request(endpoints.paymentPlans, { method: "GET" }),
      ]);

    return {
      cards: mapCards(cardsResponse),
      providers: mapProviders(providersResponse),
      spending: mapSpendingStats(statsResponse),
      invoices: mapInvoicePage(invoicesResponse, page),
      plans: mapPlans(plansResponse),
    };
  };

  return {
    async getProfile() {
      const response = await client.request(endpoints.authUserMe, { method: "GET" });
      return mapProfile(response);
    },
    async updateProfile(input) {
      await client.request(endpoints.updateUser, {
        method: "PUT",
        body: {
          username: input.username.replace(/^@+/, "").trim(),
          first_name: input.firstName.trim(),
          last_name: input.lastName.trim(),
          avatar: input.avatarUrl?.trim() || undefined,
        },
      });

      const refreshed = await client.request(endpoints.authUserMe, { method: "GET" });
      return mapProfile(refreshed);
    },
    async requestEmailVerification(email) {
      await client.request(endpoints.requestEmailVerification, {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
    },
    async updateNotifications(input) {
      await client.request(endpoints.notifications, {
        method: "POST",
        body: {
          mute: Boolean(input.mute),
          email: Boolean(input.email),
        },
      });
    },
    async updateBuilds(input) {
      await client.request(endpoints.builds, {
        method: "PUT",
        query: input.teamId ? { team_id: input.teamId } : undefined,
        body: { build_disabled: Boolean(input.buildDisabled) },
      });
    },
    async createApiKey() {
      const response = await client.request(endpoints.apiKeyCreate, { method: "POST" });
      const data = unwrapData<any>(response);
      return { apiKey: data?.api_key } as SettingsApiKeyResult;
    },
    async resetApiKey() {
      const response = await client.request(endpoints.apiKeyReset, { method: "PATCH" });
      const data = unwrapData<any>(response);
      return { apiKey: data?.api_key } as SettingsApiKeyResult;
    },
    async decryptApiKey(input: DecryptSettingsApiKeyInput) {
      const response = await client.request(endpoints.decrypt, {
        method: "POST",
        body: {
          environments: [
            {
              name: "API_KEY",
              value: input.encryptedApiKey,
            },
          ],
        },
      });

      const decrypted = unwrapData<any[]>(response);
      if (!Array.isArray(decrypted)) {
        return null;
      }

      const first = decrypted[0];
      if (!first?.value) {
        return null;
      }

      return String(first.value);
    },
    async getWebhooks() {
      const response = await client.request(endpoints.webhooks, { method: "GET" });
      return mapWebhooks(response);
    },
    async updateWebhooks(input) {
      await client.request(endpoints.webhooks, {
        method: "PATCH",
        body: {
          webhookUrl: input.webhookUrl,
          discordUrl: input.discordUrl,
          slackUrl: input.slackUrl,
          events: input.events,
        },
      });

      const refreshed = await client.request(endpoints.webhooks, {
        method: "GET",
      });

      return mapWebhooks(refreshed);
    },
    async testWebhook(input) {
      let providerType: "webhook" | "discord" | "slack";
      if (input.type === "custom") {
        providerType = "webhook";
      } else if (input.type === "discord") {
        providerType = "discord";
      } else if (input.type === "slack") {
        providerType = "slack";
      } else {
        providerType = "webhook";
      }

      await client.request(`${endpoints.webhooks}/test`, {
        method: "POST",
        body: {
          url: input.url,
          type: providerType,
          payload: createWebhookTestPayload(providerType),
        },
      });
    },
    async getInvoices(page = 1, options) {
      const subscriptionId = options?.subscriptionId?.trim() || undefined;
      const response = await client.request(endpoints.paymentInvoices, {
        method: "GET",
        query: {
          page,
          ...(subscriptionId ? { subscriptionId } : {}),
        },
      });
      return mapInvoicePage(response, page);
    },
    async getBillingSnapshot(page = 1, options) {
      return getBillingSnapshotInternal(page, options);
    },
    async getSidebarSnapshot(page = 1, options) {
      const [profileResponse, webhookResult, billingResult] =
        await Promise.all([
          client.request(endpoints.authUserMe, { method: "GET" }),
          client
            .request(endpoints.webhooks, { method: "GET" })
            .catch(() => null),
          getBillingSnapshotInternal(page, options).catch(() => null),
        ]);

      const profile = mapProfile(profileResponse);
      const webhooks = webhookResult
        ? mapWebhooks(webhookResult)
        : { webhookUrl: "", discordUrl: "", slackUrl: "", groups: [] };
      const billing = billingResult ?? {
        cards: [],
        providers: [],
        spending: { used: 0, spendingLimit: 0 },
        invoices: { items: [], page: 1, totalPages: 1 },
        plans: [],
      };

      return { profile, webhooks, billing } satisfies SettingsSidebarSnapshot;
    },
    async disconnectGitProvider(provider: GitProvider) {
      await client.request(
        `${endpoints.disconnectProvider}/${encodeURIComponent(provider)}`,
        { method: "DELETE" },
      );
    },
  };
}
