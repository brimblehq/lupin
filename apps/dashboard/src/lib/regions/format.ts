export interface RegionLabelInput {
  name: string;
  country?: string | null;
}

export function buildRegionLabel(region: RegionLabelInput): string {
  const country = region.country?.trim();
  if (country) {
    return `${region.name} (${country})`;
  }

  return region.name;
}
