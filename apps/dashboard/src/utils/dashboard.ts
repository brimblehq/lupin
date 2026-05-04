import type { SettingsSidebarSnapshot } from "@/backend/settings";

export interface DrawerUserProfile {
  firstName: string;
  lastName: string;
  username: string;
  uniqueId: string;
  email: string;
  avatarUrl?: string;
  buildsEnabled?: boolean;
  buildDisabledBy?: string | null;
  haptics?: boolean;
  followedX?: boolean;
  spendingLimit?: number | null;
  notifications?: {
    mute: boolean;
    email: boolean;
  };
  apiKey?: string;
  subscriptionPlanType?: string;
  subscriptionDue?: boolean;
}

export function mapSettingsSnapshotToDrawerProfile(snapshot: SettingsSidebarSnapshot | null): DrawerUserProfile | null {
  if (!snapshot) {
    return null;
  }

  return {
    firstName: snapshot.profile.firstName,
    lastName: snapshot.profile.lastName,
    username: snapshot.profile.username,
    uniqueId: snapshot.profile.id,
    email: snapshot.profile.email,
    avatarUrl: snapshot.profile.avatarUrl,
    buildsEnabled: !snapshot.profile.buildDisabled,
    buildDisabledBy: snapshot.profile.buildDisabledBy ?? null,
    haptics: snapshot.profile.haptics,
    followedX: snapshot.profile.followedX,
    spendingLimit: snapshot.profile.spendingLimit ?? null,
    notifications: snapshot.profile.notifications,
    apiKey: snapshot.profile.apiKey,
    subscriptionPlanType: snapshot.profile.subscription?.planType,
    subscriptionDue: snapshot.profile.subscription?.due,
  };
}

export function maskSecretWithAsterisks(value: string): string {
  if (!value) {
    return "";
  }

  return "*".repeat(Math.max(value.length, 24));
}

export function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRelativeTime(value?: string): string {
  if (!value) {
    return "recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
