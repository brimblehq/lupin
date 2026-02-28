function readEnv(key: string): string | undefined {
  const fromVite =
    typeof import.meta !== "undefined"
      ? ((import.meta as ImportMeta).env?.[key] as string | undefined)
      : undefined;

  if (fromVite) return fromVite;

  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (maybeProcess?.env) {
    return maybeProcess.env[key];
  }

  return undefined;
}

const gatewayUrl = readEnv("NEXT_PUBLIC_GATEWAY_URL") ?? readEnv("VITE_GATEWAY_URL") ?? "https://api.brimble.io";

export const config = {
  gatewayUrl,
  apiUrl: `${gatewayUrl}/core`,
  authApiUrl: `${gatewayUrl}/auth`,
  dnsApiUrl: `${gatewayUrl}/dns`,
  paymentApiUrl: `${gatewayUrl}/payment/api`,
  logsSocketUrl: `${gatewayUrl}/core`,
  avatarUrl:
    readEnv("NEXT_PUBLIC_AVATAR_URL") ??
    readEnv("VITE_AVATAR_URL") ??
    "https://api.dicebear.com/7.x",
  uploadUrl:
    readEnv("NEXT_PUBLIC_UPLOAD_URL") ??
    readEnv("VITE_UPLOAD_URL") ??
    "https://api.cloudinary.com/v1_1/dgqfojhx4/image/upload",
  accessTokenCookie: "brimble_access_token",
  refreshTokenCookie: "brimble_refresh_token",
  authToken: readEnv("NEXT_PUBLIC_AUTH_TOKEN") ?? readEnv("VITE_AUTH_TOKEN") ?? "",
  hmacSecretKey:
    readEnv("NEXT_PUBLIC_HMAC_SECRET_KEY") ?? readEnv("VITE_HMAC_SECRET_KEY") ?? "",
  supabaseUrl:
    readEnv("NEXT_PUBLIC_SUPABASE_URL") ?? readEnv("VITE_SUPABASE_URL") ?? "",
  supabaseKey:
    readEnv("NEXT_PUBLIC_SUPABASE_KEY") ?? readEnv("VITE_SUPABASE_KEY") ?? "",
  supabaseTableName:
    readEnv("NEXT_PUBLIC_SUPABASE_TABLE_NAME") ??
    readEnv("VITE_SUPABASE_TABLE_NAME") ??
    "BRIMBLE_DEPLOYMENT_LOGS",
  apiKey: readEnv("NEXT_PUBLIC_AUTH_TOKEN") ?? readEnv("VITE_AUTH_TOKEN") ?? "",
  api_key: readEnv("NEXT_PUBLIC_AUTH_TOKEN") ?? readEnv("VITE_AUTH_TOKEN") ?? "",
  stripePublishableKey:
    readEnv("NEXT_PUBLIC_STRIPE_KEY") ?? readEnv("VITE_STRIPE_KEY") ?? "",

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
} as const;

export default config;

export type AppConfig = typeof config;
