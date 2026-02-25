export interface ParsedDockerImageRef {
  imageUri: string;
  repository: string;
  tag: string;
}

function looksLikeRegistryHost(part: string) {
  return part.includes(".") || part.includes(":") || part === "localhost";
}

export function parseDockerImageRef(input: string): ParsedDockerImageRef | null {
  const imageUri = input.trim();
  if (!imageUri) return null;

  const lastSlash = imageUri.lastIndexOf("/");
  const lastColon = imageUri.lastIndexOf(":");
  const hasTag = lastColon > lastSlash;

  const withoutTag = hasTag ? imageUri.slice(0, lastColon) : imageUri;
  const tag = hasTag ? imageUri.slice(lastColon + 1) : "latest";

  if (!withoutTag || !tag) {
    return null;
  }

  const parts = withoutTag.split("/").filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  let repository = withoutTag;
  if (parts.length > 1 && looksLikeRegistryHost(parts[0] ?? "")) {
    repository = parts.slice(1).join("/");
  }

  return {
    imageUri,
    repository,
    tag,
  };
}

export function inferProjectNameFromDockerImage(input: string) {
  const parsed = parseDockerImageRef(input);
  if (!parsed) return "";
  const leaf = parsed.repository.split("/").filter(Boolean).pop();
  return leaf ?? "";
}
