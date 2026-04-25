import type { FrameworkOption } from "@/backend/frameworks";

export type FrameworkDropdownOption = {
  id: string;
  label: string;
  icon?: string;
  iconClassName?: string;
  tooltipMessage?: string;
  type?: string;
};

export function mapFrameworksToDropdownOptions(frameworks: FrameworkOption[] | undefined | null): FrameworkDropdownOption[] {
  return (frameworks || []).map((item) => {
    const slug = item.slug?.trim().toLowerCase() || "";
    const name = item.name?.trim().toLowerCase() || "";
    const isOtherFramework = slug === "other" || slug === "custom" || name === "other";

    return {
      id: item.slug,
      label: item.name,
      icon: item.logo || undefined,
      iconClassName: isOtherFramework ? "dark:invert" : undefined,
      tooltipMessage: item.tooltipMessage,
      type: item.type,
    };
  });
}
