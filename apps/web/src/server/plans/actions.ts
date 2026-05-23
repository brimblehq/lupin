import { createServerFn } from "@tanstack/react-start";

export interface PlanSummary {
  planType: string;
  name: string;
  description: string;
  price: number;
  level: number;
  popular: boolean;
  features: string[];
}

export interface PlansResult {
  personal: PlanSummary[];
  team: PlanSummary | null;
}

interface PlanConfiguration {
  concurrent_builds: number;
  project_limit: number;
  build_minutes: number;
  log_retention: number;
  bandwidth: number;
  memory: number;
  storage: number;
  cpu: number;
  custom_domain: boolean;
  analytics: boolean;
  multi_region: boolean;
  pull_request_preview: boolean;
  autoscaling_enabled: boolean;
  view_metrics: boolean;
  webhook_enabled: boolean;
  slack_support: boolean;
  can_deploy_all_applications: boolean;
  unlimited_projects: boolean;
  sandbox_enabled: boolean;
  sandbox_max_count: number;
  sandbox_max_vcpu: number;
  sandbox_max_memory_gb: number;
  sandbox_cpu_hours_included: number;
  sandbox_memory_gb_hours_included: number;
}

function readEnv(key: string): string | undefined {
  const fromVite = typeof import.meta !== "undefined" ? ((import.meta as ImportMeta).env?.[key] as string | undefined) : undefined;
  if (fromVite) return fromVite;

  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return maybeProcess?.env?.[key];
}

function getPlansEndpoint() {
  const gatewayUrl = readEnv("NEXT_PUBLIC_GATEWAY_URL") ?? readEnv("VITE_GATEWAY_URL") ?? "https://api.brimble.io";
  return `${gatewayUrl.replace(/\/$/, "")}/core/v1/plans`;
}

function stripPlanSuffix(title: string): string {
  return title.replace(/\s+Plan$/i, "").trim();
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseConfiguration(raw: any): PlanConfiguration {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    concurrent_builds: num(c.concurrent_builds),
    project_limit: num(c.project_limit),
    build_minutes: num(c.build_minutes),
    log_retention: num(c.log_retention),
    bandwidth: num(c.bandwidth),
    memory: num(c.memory),
    storage: num(c.storage),
    cpu: num(c.cpu),
    custom_domain: Boolean(c.custom_domain),
    analytics: Boolean(c.analytics),
    multi_region: Boolean(c.multi_region),
    pull_request_preview: Boolean(c.pull_request_preview),
    autoscaling_enabled: Boolean(c.autoscaling_enabled),
    view_metrics: Boolean(c.view_metrics),
    webhook_enabled: Boolean(c.webhook_enabled),
    slack_support: Boolean(c.slack_support),
    can_deploy_all_applications: Boolean(c.can_deploy_all_applications),
    unlimited_projects: Boolean(c.unlimited_projects),
    sandbox_enabled: Boolean(c.sandbox_enabled),
    sandbox_max_count: num(c.sandbox_max_count),
    sandbox_max_vcpu: num(c.sandbox_max_vcpu),
    sandbox_max_memory_gb: num(c.sandbox_max_memory_gb),
    sandbox_cpu_hours_included: num(c.sandbox_cpu_hours_included),
    sandbox_memory_gb_hours_included: num(c.sandbox_memory_gb_hours_included),
  };
}

function buildFeatures(config: PlanConfiguration, previous: { name: string; configuration: PlanConfiguration } | null): string[] {
  const features: string[] = [];
  const prev = previous?.configuration;

  if (previous) {
    features.push(`All ${previous.name} plan features`);
  } else {
    features.push("Automatic HTTPS/SSL");
  }

  const newBoolean = (current: boolean, previousValue: boolean) => current && (!prev || !previousValue);

  if (!config.can_deploy_all_applications && !previous) features.push("Deploy Static Sites");
  if (newBoolean(config.can_deploy_all_applications, prev?.can_deploy_all_applications ?? false)) features.push("Deploy Fullstack Apps");
  if (newBoolean(config.custom_domain, prev?.custom_domain ?? false)) features.push("Custom Domains");
  if (newBoolean(config.analytics, prev?.analytics ?? false)) features.push("Brimble Web Analytics");
  if (newBoolean(config.multi_region, prev?.multi_region ?? false)) features.push("Multi-Region Support");
  if (newBoolean(config.pull_request_preview, prev?.pull_request_preview ?? false)) features.push("Pull Request Previews");
  if (newBoolean(config.autoscaling_enabled, prev?.autoscaling_enabled ?? false)) features.push("Autoscaling Resources");
  if (newBoolean(config.view_metrics, prev?.view_metrics ?? false)) features.push("View Metrics");
  if (newBoolean(config.webhook_enabled, prev?.webhook_enabled ?? false)) features.push("Webhooks");
  if (newBoolean(config.slack_support, prev?.slack_support ?? false)) features.push("Priority Slack Support");

  if (config.unlimited_projects) {
    if (!prev?.unlimited_projects) features.push("Unlimited Projects");
  } else if (config.project_limit > 0) {
    features.push(`${config.project_limit} Project Limit`);
  }

  const improved = (current: number, previousValue: number | undefined) => current > 0 && (previousValue === undefined || current !== previousValue);

  const cpuChanged = improved(config.cpu, prev?.cpu);
  const memoryChanged = improved(config.memory, prev?.memory);
  if (cpuChanged || memoryChanged) {
    const computeParts: string[] = [];
    if (config.cpu > 0) computeParts.push(`${config.cpu} vCPU`);
    if (config.memory > 0) computeParts.push(`${config.memory} GB RAM`);
    if (computeParts.length > 0) features.push(computeParts.join(" / "));
  }

  if (improved(config.concurrent_builds, prev?.concurrent_builds)) {
    features.push(`${config.concurrent_builds} Concurrent Build${config.concurrent_builds === 1 ? "" : "s"}`);
  }

  if (improved(config.build_minutes, prev?.build_minutes)) features.push(`${config.build_minutes.toLocaleString("en-US")} Build Minutes`);
  if (improved(config.bandwidth, prev?.bandwidth)) features.push(`${config.bandwidth} GB Bandwidth`);
  if (improved(config.storage, prev?.storage)) features.push(`${config.storage} GB Storage`);
  if (improved(config.log_retention, prev?.log_retention)) features.push(`${config.log_retention}-day Log Retention`);

  if (config.sandbox_enabled) {
    if (improved(config.sandbox_max_count, prev?.sandbox_max_count)) {
      features.push(`${config.sandbox_max_count} Concurrent Sandbox${config.sandbox_max_count === 1 ? "" : "es"}`);
    }
    if (improved(config.sandbox_max_vcpu, prev?.sandbox_max_vcpu) || improved(config.sandbox_max_memory_gb, prev?.sandbox_max_memory_gb)) {
      features.push(`Up to ${config.sandbox_max_vcpu} vCPU / ${config.sandbox_max_memory_gb} GB Sandboxes`);
    }
    if (improved(config.sandbox_cpu_hours_included, prev?.sandbox_cpu_hours_included) || improved(config.sandbox_memory_gb_hours_included, prev?.sandbox_memory_gb_hours_included)) {
      features.push(`${config.sandbox_cpu_hours_included} Sandbox CPU + ${config.sandbox_memory_gb_hours_included} GB-hrs Included`);
    }
  }

  return features;
}

function mapPlan(planType: string, raw: any): (PlanSummary & { configuration: PlanConfiguration }) | null {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title : "";
  if (!title) return null;
  return {
    planType,
    name: stripPlanSuffix(title),
    description: typeof raw.tagLine === "string" ? raw.tagLine : "",
    price: num(raw.amount),
    level: num(raw.level),
    popular: Boolean(raw.isRecommended),
    features: [],
    configuration: parseConfiguration(raw.configuration),
  };
}

export const listPlansServerFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<PlansResult> => {
  const response = await fetch(getPlansEndpoint(), {
    headers: { Accept: "application/json" },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof json?.message === "string" ? json.message : "Failed to fetch plans");
  }

  const data = json?.data ?? {};
  const mapped = Object.entries(data)
    .map(([planType, raw]) => mapPlan(planType, raw))
    .filter((plan): plan is PlanSummary & { configuration: PlanConfiguration } => plan !== null)
    .sort((a, b) => a.level - b.level);

  const withFeatures: PlanSummary[] = mapped.map((plan, index) => {
    const previous = index > 0 ? mapped[index - 1] : null;
    const { configuration: _configuration, ...rest } = plan;
    return {
      ...rest,
      features: buildFeatures(
        plan.configuration,
        previous ? { name: previous.name, configuration: previous.configuration } : null,
      ),
    };
  });

  const team = withFeatures.find((plan) => plan.planType === "TEAM_PLAN") ?? null;
  const personal = withFeatures.filter((plan) => plan.planType !== "TEAM_PLAN");

  return { personal, team };
});
