import type { ApiClient } from "./types";
import { asRecord, pickString } from "./normalize";

export interface FrameworkOption {
  slug: string;
  name: string;
  logo?: string;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  outputDirectory?: string;
}

export interface FrameworksApi {
  list(): Promise<FrameworkOption[]>;
}

export function createFrameworksApi(client: ApiClient): FrameworksApi {
  return {
    async list() {
      const response = await client.request<any>("/core/v1/frameworks", {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? [];
      const items = Array.isArray(root) ? root : [];

      const frameworks = items
        .map((item: any) => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }

          const slug = pickString(row, "slug") ?? "";
          const name = pickString(row, "name") ?? "";

          if (!slug || !name) {
            return null;
          }

          return {
            slug,
            name,
            logo: pickString(row, "logo"),
            installCommand: pickString(row, "installCommand"),
            buildCommand: pickString(row, "buildCommand"),
            startCommand: pickString(row, "startCommand"),
            outputDirectory: pickString(row, "outputDirectory"),
          } satisfies FrameworkOption;
        })
        .filter((item): item is FrameworkOption => item !== null);

      frameworks.sort((a, b) => a.name.localeCompare(b.name));

      return frameworks;
    },
  };
}
