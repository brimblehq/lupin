export type MigrationProviderId = "aws-s3" | "cloudflare-r2" | "backblaze-b2" | "wasabi" | "do-spaces" | "custom";

export interface MigrationProviderPreset {
  id: MigrationProviderId;
  name: string;
  endpointHint: string;
  regionHint: string;
}

export const MIGRATION_PROVIDERS: MigrationProviderPreset[] = [
  { id: "aws-s3", name: "AWS S3", endpointHint: "Leave blank for AWS", regionHint: "us-east-1" },
  { id: "cloudflare-r2", name: "Cloudflare R2", endpointHint: "https://<account>.r2.cloudflarestorage.com", regionHint: "auto" },
  { id: "backblaze-b2", name: "Backblaze B2", endpointHint: "https://s3.<region>.backblazeb2.com", regionHint: "us-west-002" },
  { id: "wasabi", name: "Wasabi", endpointHint: "https://s3.<region>.wasabisys.com", regionHint: "us-east-1" },
  { id: "do-spaces", name: "DigitalOcean Spaces", endpointHint: "https://<region>.digitaloceanspaces.com", regionHint: "nyc3" },
  { id: "custom", name: "Custom (S3-compatible)", endpointHint: "https://storage.example.com", regionHint: "auto" },
];
