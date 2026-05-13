function readEnv(key: string): string | undefined {
  const fromVite = typeof import.meta !== "undefined" ? ((import.meta as ImportMeta).env?.[key] as string | undefined) : undefined;

  if (fromVite) return fromVite;

  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (maybeProcess?.env) {
    return maybeProcess.env[key];
  }

  return undefined;
}

const gatewayUrl = readEnv("VITE_GATEWAY_URL") ?? "https://api.brimble.io";

export const config = {
  gatewayUrl,
  apiUrl: `${gatewayUrl}/core`,
  authApiUrl: `${gatewayUrl}/auth`,
  paymentApiUrl: `${gatewayUrl}/payment/api`,
  logsSocketUrl: `${gatewayUrl}/core`,
  avatarUrl: readEnv("VITE_AVATAR_URL") ?? "https://api.dicebear.com/7.x",
  uploadUrl: readEnv("VITE_UPLOAD_URL") ?? "https://api.cloudinary.com/v1_1/dgqfojhx4/image/upload",
  accessTokenCookie: "brimble_access_token",
  refreshTokenCookie: "brimble_refresh_token",
  environmentPreferenceCookiePrefix: "brimble_env_pref_",
  supabaseUrl: readEnv("SUPABASE_URL") ?? readEnv("VITE_SUPABASE_URL") ?? "",
  supabaseAnonKey: readEnv("SUPABASE_ANON_KEY") ?? "",
  supabaseJwtPrivateKey: (readEnv("SUPABASE_JWT_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n"),
  supabaseJwtKid: readEnv("SUPABASE_JWT_KID") ?? "",
  supabaseTableName: readEnv("VITE_SUPABASE_TABLE_NAME") ?? "BRIMBLE_DEPLOYMENT_LOGS",
  aiDebugModel: readEnv("VITE_AI_DEBUG_MODEL") ?? readEnv("AI_DEBUG_MODEL") ?? "gpt-5.1-codex-mini",
  stripePublishableKey: readEnv("VITE_STRIPE_KEY") ?? "",

  defaultPlanFreePrice: Number(readEnv("VITE_DEFAULT_PLAN_FREE_PRICE") ?? "0"),
  defaultPlanHackerPrice: Number(readEnv("VITE_DEFAULT_PLAN_HACKER_PRICE") ?? "5"),
  defaultPlanProPrice: Number(readEnv("VITE_DEFAULT_PLAN_PRO_PRICE") ?? "15"),
  defaultTeamCostPerMember: Number(readEnv("VITE_DEFAULT_TEAM_COST_PER_MEMBER") ?? "5"),
  defaultTeamCostPerBuild: Number(readEnv("VITE_DEFAULT_TEAM_COST_PER_BUILD") ?? "8"),
  defaultTeamMaxProjects: Number(readEnv("VITE_DEFAULT_TEAM_MAX_PROJECTS") ?? "500"),
  defaultTeamBandwidthGb: Number(readEnv("VITE_DEFAULT_TEAM_BANDWIDTH_GB") ?? "500"),
  defaultTeamConcurrentBuilds: Number(readEnv("VITE_DEFAULT_TEAM_CONCURRENT_BUILDS") ?? "2"),
  defaultTeamLogRetentionDays: Number(readEnv("VITE_DEFAULT_TEAM_LOG_RETENTION_DAYS") ?? "30"),
  defaultOverageBandwidthPerGb: Number(readEnv("VITE_DEFAULT_OVERAGE_BANDWIDTH_PER_GB") ?? "0.25"),
  defaultOverageBuildMinutesPerMin: Number(readEnv("VITE_DEFAULT_OVERAGE_BUILD_MINUTES_PER_MIN") ?? "0.002"),
  buildMinutesTopUpPerDollar: Number(readEnv("VITE_BUILD_MINUTES_TOPUP_PER_DOLLAR") ?? "288"),
  databaseFreeTrialDays: Number(readEnv("VITE_DB_FREE_TRIAL_DAYS") ?? "15"),

  accessTokenTtl: Number(readEnv("VITE_ACCESS_TOKEN_TTL") ?? String(60 * 60)),
  refreshTokenTtl: Number(readEnv("VITE_REFRESH_TOKEN_TTL") ?? String(60 * 60 * 24)),

  turnstileSiteKey: readEnv("VITE_TURNSTILE_SITE_KEY") ?? "",

  posthogKey: readEnv("VITE_POSTHOG_KEY") ?? "",
  posthogHost: readEnv("VITE_POSTHOG_HOST") ?? "https://us.i.posthog.com",
} as const;

export default config;

export type AppConfig = typeof config;
