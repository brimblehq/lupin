export enum SandboxStatus {
  Starting = "starting",
  Ready = "ready",
  Paused = "paused",
  Pausing = "pausing",
  Resuming = "resuming",
  Failed = "failed",
  Destroyed = "destroyed",
}

export enum SnapshotMode {
  Manual = "manual",
  Automatic = "automatic",
}

export enum DestroyTimeout {
  ThirtyMinutes = "30m",
  OneHour = "1h",
  ThreeHours = "3h",
  SixHours = "6h",
  TwelveHours = "12h",
  EighteenHours = "18h",
}

export enum SnapshotStatus {
  Creating = "creating",
  Ready = "ready",
  Failed = "failed",
}

export enum SandboxActivityStatus {
  Running = "running",
  Succeeded = "succeeded",
  Failed = "failed",
}

export enum SandboxDestroyReason {
  User = "user",
  IdleTtl = "idle_ttl",
  MaxLifetime = "max_lifetime",
  OneShotStopped = "one_shot_stopped",
  Failed = "failed",
  PausedTooLong = "paused_too_long",
}

export const SANDBOX_STATUS_VALUES = Object.values(SandboxStatus);
export const SNAPSHOT_MODE_VALUES = Object.values(SnapshotMode);
export const SNAPSHOT_STATUS_VALUES = Object.values(SnapshotStatus);
export const SANDBOX_ACTIVITY_STATUS_VALUES = Object.values(SandboxActivityStatus);
export const DESTROY_TIMEOUT_VALUES = Object.values(DestroyTimeout);
export const SANDBOX_DESTROY_REASON_VALUES = Object.values(SandboxDestroyReason);
