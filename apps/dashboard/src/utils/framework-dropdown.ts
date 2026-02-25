import type { FrameworkOption } from "@/backend/frameworks";

export type FrameworkDropdownOption = {
  id: string;
  label: string;
  icon?: string;
};

export function mapFrameworksToDropdownOptions(
  frameworks: FrameworkOption[] | undefined | null,
): FrameworkDropdownOption[] {
  return (frameworks || []).map((item) => ({
    id: item.slug,
    label: item.name,
    icon: item.logo || undefined,
  }));
}
