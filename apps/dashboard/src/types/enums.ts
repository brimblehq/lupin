export enum PaletteView {
  Root = "root",
  ProjectSearch = "project-search",
  DomainSearch = "domain-search",
  WorkspaceSearch = "workspace-search",
  EnvironmentSearch = "environment-search",
}

export enum Theme {
  Light = "light",
  Dark = "dark",
  System = "system",
}

export enum SourceType {
  Github = "github",
  Gitlab = "gitlab",
  Docker = "docker",
  Database = "database",
}

export enum ConfigSection {
  General = "general",
  Build = "build",
  Resources = "resources",
  Danger = "danger",
}

export enum LogTab {
  Application = "application",
  Request = "request",
}

export enum MetricChart {
  MemoryUsage = "Memory Usage",
  CpuUsage = "CPU Usage",
  NetworkEgress = "Network Egress",
  ResponseTimes = "Response Times",
}

export enum ChipVariant {
  Green = "green",
  Red = "red",
  Orange = "orange",
  Gray = "gray",
}

export enum WorkspaceStep {
  Name = "name",
  Config = "config",
  Invite = "invite",
  Done = "done",
}

export enum DomainStep {
  SelectProject = "select-project",
  EnterDomain = "enter-domain",
  TransferIn = "transfer-in",
}

export enum ProfileTab {
  Profile = "profile",
  ActivitySession = "activity-session",
  Members = "members",
  Notifications = "notifications",
  Security = "security",
  Billing = "billing",
}
