export function formatTimeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function toKbps(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return value / 1024;
}

export const timeIntervals = ["Last 1 Hour", "Last 6 Hours", "Last 24 Hours", "Last 7 Days", "Last 30 Days"] as const;

export function hoursAgoForInterval(interval: string): number {
  if (interval === "Last 1 Hour") return 1;
  if (interval === "Last 6 Hours") return 6;
  if (interval === "Last 24 Hours") return 24;
  if (interval === "Last 7 Days") return 24 * 7;
  if (interval === "Last 30 Days") return 24 * 30;
  return 1;
}

export function formatYTick(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "ms") return `${value.toFixed(0)}ms`;
  if (unit === "KB/s") return `${value.toFixed(1)}`;
  return value.toFixed(1);
}
