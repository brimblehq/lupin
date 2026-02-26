export interface SettingsUserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  buildDisabled: boolean;
  apiKey?: string;
  notifications: {
    mute: boolean;
    email: boolean;
  };
  subscription?: {
    id?: string;
    planType?: string;
    due?: boolean;
  };
}

export interface UpdateSettingsProfileInput {
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl?: string;
}

export interface UpdateSettingsNotificationsInput {
  mute: boolean;
  email: boolean;
}

export interface UpdateSettingsBuildsInput {
  buildDisabled: boolean;
}

export interface SettingsApiKeyResult {
  apiKey?: string;
}

export interface DecryptSettingsApiKeyInput {
  encryptedApiKey: string;
}

export interface SettingsWebhookEvent {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface SettingsWebhookGroup {
  title: string;
  events: SettingsWebhookEvent[];
}

export interface SettingsWebhookState {
  webhookUrl: string;
  discordUrl: string;
  slackUrl: string;
  groups: SettingsWebhookGroup[];
}

export interface UpdateSettingsWebhooksInput {
  webhookUrl: string | null;
  discordUrl: string | null;
  slackUrl: string | null;
  events: string[];
}

export interface SettingsPaymentCard {
  id: string;
  cardType?: string;
  expMonth?: string;
  expYear?: string;
  last4?: string;
  preferred: boolean;
  provider?: string;
}

export interface SettingsPaymentProvider {
  name: string;
  enum: string;
  logo?: string;
  description?: string;
  features?: string[];
}

export interface SettingsSpendingStats {
  used: number;
  spendingLimit: number;
}

export interface SettingsInvoiceItem {
  id: string;
  createdAt?: string;
  total: number;
  due: boolean;
  description?: string;
  downloadLink?: string;
}

export interface SettingsInvoicePage {
  page: number;
  totalPages: number;
  limit?: number;
  items: SettingsInvoiceItem[];
}

export interface SettingsPlan {
  key: string;
  amount: number;
  tagLine?: string;
  isRecommended?: boolean;
  features: string[];
}

export interface SettingsBillingSnapshot {
  cards: SettingsPaymentCard[];
  providers: SettingsPaymentProvider[];
  spending: SettingsSpendingStats;
  invoices: SettingsInvoicePage;
  plans: SettingsPlan[];
}

export interface SettingsSidebarSnapshot {
  profile: SettingsUserProfile;
  webhooks: SettingsWebhookState;
  billing: SettingsBillingSnapshot;
}

export interface TestWebhookInput {
  url: string;
  type: "discord" | "slack" | "webhook" | "custom";
}

export interface InitializeSettingsAddCardInput {
  paymentChannel: string;
}

export interface InitializeSettingsAddCardResult {
  paymentLink: string;
}

export type GitProvider = "bitbucket" | "github" | "gitlab" | "huggingface";

export interface SettingsApi {
  getSidebarSnapshot(page?: number, options?: { subscriptionId?: string }): Promise<SettingsSidebarSnapshot>;
  getProfile(): Promise<SettingsUserProfile>;
  updateProfile(input: UpdateSettingsProfileInput): Promise<SettingsUserProfile>;
  requestEmailVerification(email: string): Promise<void>;
  updateNotifications(input: UpdateSettingsNotificationsInput): Promise<void>;
  updateBuilds(input: UpdateSettingsBuildsInput): Promise<void>;
  createApiKey(): Promise<SettingsApiKeyResult>;
  resetApiKey(): Promise<SettingsApiKeyResult>;
  decryptApiKey(input: DecryptSettingsApiKeyInput): Promise<string | null>;
  getWebhooks(): Promise<SettingsWebhookState>;
  updateWebhooks(input: UpdateSettingsWebhooksInput): Promise<SettingsWebhookState>;
  testWebhook(input: TestWebhookInput): Promise<void>;
  initializeAddCard(input: InitializeSettingsAddCardInput): Promise<InitializeSettingsAddCardResult>;
  getBillingSnapshot(page?: number, options?: { subscriptionId?: string }): Promise<SettingsBillingSnapshot>;
  getInvoices(page?: number, options?: { subscriptionId?: string }): Promise<SettingsInvoicePage>;
  disconnectGitProvider(provider: GitProvider): Promise<void>;
}
