import publicConfig from "@/config";

function readServerEnv(...keys: string[]): string | undefined {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) {
    return undefined;
  }

  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export const serverConfig = {
  ...publicConfig,
  authToken: readServerEnv("AUTH_TOKEN", "BRIMBLE_AUTH_TOKEN", "VITE_AUTH_TOKEN", "NEXT_PUBLIC_AUTH_TOKEN") ?? "",
  apiKey: readServerEnv("AUTH_TOKEN", "BRIMBLE_AUTH_TOKEN", "VITE_AUTH_TOKEN", "NEXT_PUBLIC_AUTH_TOKEN") ?? "",
  hmacSecretKey: readServerEnv("HMAC_SECRET_KEY", "BRIMBLE_HMAC_SECRET_KEY", "VITE_HMAC_SECRET_KEY", "NEXT_PUBLIC_HMAC_SECRET_KEY") ?? "",
} as const;

export default serverConfig;

export type ServerConfig = typeof serverConfig;
