import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ReactFlow, Background, BackgroundVariant, Handle, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { HoverCard } from "radix-ui";
import {
  ShieldCheck,
  GlobeSimple,
  Lightning,
  HardDrives,
  HardDrive,
  TreeStructure,
  Info,
  ArrowsVertical,
  ArrowRight,
  Cpu,
  Memory,
  Stack,
  Database,
  PlugsConnected,
  ClockCounterClockwise,
  Clock,
  Hash,
  Cube,
  MapPin,
} from "@phosphor-icons/react";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Theme } from "@/types/enums";
import { formatRelativeTime } from "@/utils/dashboard";
import type { Project } from "@/backend/projects";
import type { NetworkSettings } from "@/backend/networking";
import type { ScalingGroup } from "@/backend/scaling";
import { SimpleTooltip } from "@/components/shared/tooltip";
import { decryptDatabaseConnectionUriServerFn } from "@/server/projects/actions";
import { NetworkSettingsDrawer } from "./network-settings-drawer";
import { isStaticProject } from "@/utils/project-capabilities";

type Tone = "green" | "amber" | "red" | "blue" | "gray";

const DOT_CLASS: Record<Tone, string> = {
  green: "bg-[#3a9d6e]",
  amber: "bg-[#f5a623]",
  red: "bg-[#ef2f1f]",
  blue: "bg-[#4879f8]",
  gray: "bg-dash-text-extra-faded",
};

const VALUE_CLASS: Record<Tone, string> = {
  green: "text-[#3a9d6e]",
  amber: "text-[#f5a623]",
  red: "text-[#ef2f1f]",
  blue: "text-[#4879f8]",
  gray: "text-dash-text-extra-faded",
};

function StatusValue({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`flex items-center gap-1.5 text-[13px] ${VALUE_CLASS[tone]}`}>
      <span className={`size-1.5 rounded-full ${DOT_CLASS[tone]}`} />
      {label}
    </span>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-dash-text-faded">
        {icon}
        <span className="min-w-0">{label}</span>
      </span>
      <span className="shrink-0">{value}</span>
    </div>
  );
}

function DiagramCard({ title, icon, onClick, children }: { title: string; icon: ReactNode; onClick?: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={`overflow-hidden rounded-[6px] border-[0.5px] border-dash-border bg-dash-bg ${
        onClick
          ? "cursor-pointer transition-all duration-150 hover:border-[#4879f8] hover:shadow-[0px_0px_0px_3px_rgba(72,121,248,0.12)]"
          : ""
      }`}
    >
      <div className="flex items-center gap-2.5 border-b-[0.5px] border-dash-border px-3.5 py-2.5 text-sm font-medium text-dash-text-strong">
        {icon}
        {title}
      </div>
      <div className="flex flex-col divide-y-[0.5px] divide-dash-border">{children}</div>
    </div>
  );
}

const ICON_CLASS = "size-4 shrink-0 text-dash-text-extra-faded";

interface NetworkPanelProps {
  ddos: { label: string; tone: Tone };
  cdn: { label: string; tone: Tone };
  edgeCaching: { label: string; tone: Tone };
  cloudDomain?: string;
  customDomains: { label: string; tone: Tone };
  onEdgeClick: () => void;
  onDomainsClick: () => void;
}

interface ClusterPanelProps {
  region: string;
  compute: string;
  status: { label: string; tone: Tone };
  onClick: () => void;
}

interface StaticHostingPanelProps {
  region: string;
  status: { label: string; tone: Tone };
  onClick: () => void;
}

interface ScalingPanelProps {
  configured: boolean;
  instances?: string;
  cpu?: string;
  memory?: string;
  status?: { label: string; tone: Tone };
  onClick: () => void;
}

function NetworkInfoCard() {
  const [open, setOpen] = useState(false);
  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          aria-label="About edge networking"
          className="flex size-4 items-center justify-center text-dash-text-extra-faded outline-none transition-colors hover:text-dash-text-faded"
        >
          <Info className="size-4" />
        </button>
      </HoverCard.Trigger>
      <AnimatePresence>
        {open && (
          <HoverCard.Portal forceMount>
            <HoverCard.Content side="bottom" align="end" sideOffset={10} asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="z-50 w-[320px] rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg p-4 shadow-[0px_12px_32px_rgba(3,7,18,0.14)]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-dash-text-strong">Edge network</p>
                  <span className="flex items-center gap-1.5">
                    <img src="/icons/cloudflare.svg" alt="" aria-hidden="true" className="size-5" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-dash-text-faded">Cloudflare</span>
                  </span>
                </div>
                <div className="flex flex-col gap-3 text-[13px] leading-[1.5] text-dash-text-faded">
                  <p>Brimble partners with Cloudflare to power edge networking for your project.</p>
                  <p>
                    Cloudflare's global edge spans 300+ data centers — cutting latency, blocking DDoS attacks, caching content, and keeping
                    traffic fast and reliable.
                  </p>
                </div>
                <a
                  href="https://www.cloudflare.com/network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-[13px] font-medium text-[#4879f8] hover:underline"
                >
                  Learn more
                </a>
              </motion.div>
            </HoverCard.Content>
          </HoverCard.Portal>
        )}
      </AnimatePresence>
    </HoverCard.Root>
  );
}

function NetworkPanel({ ddos, cdn, edgeCaching, cloudDomain, customDomains, onEdgeClick, onDomainsClick }: NetworkPanelProps) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-2.5">
      <div className="flex items-center justify-between px-1.5 pb-2.5 pt-1 text-[13px] text-dash-text-faded">
        <span>Network</span>
        <NetworkInfoCard />
      </div>
      <div className="flex flex-col gap-2">
        <DiagramCard title="Edge network" icon={<TreeStructure className={ICON_CLASS} />} onClick={onEdgeClick}>
          <Row icon={<ShieldCheck className={ICON_CLASS} />} label="DDoS protection" value={<StatusValue {...ddos} />} />
          <Row icon={<GlobeSimple className={ICON_CLASS} />} label="CDN" value={<StatusValue {...cdn} />} />
          <Row icon={<Lightning className={ICON_CLASS} />} label="Edge caching" value={<StatusValue {...edgeCaching} />} />
        </DiagramCard>
        <DiagramCard title="Domains" icon={<GlobeSimple className={ICON_CLASS} />} onClick={onDomainsClick}>
          <Row
            icon={<GlobeSimple className={ICON_CLASS} />}
            label={
              <span className="flex flex-col">
                <span className="text-dash-text-faded">Cloud domain</span>
                {cloudDomain ? (
                  <SimpleTooltip content={cloudDomain}>
                    <span className="truncate font-mono text-xs text-dash-text-extra-faded">{cloudDomain}</span>
                  </SimpleTooltip>
                ) : null}
              </span>
            }
            value={<StatusValue label={cloudDomain ? "Enabled" : "Not set"} tone={cloudDomain ? "green" : "gray"} />}
          />
          <Row icon={<GlobeSimple className={ICON_CLASS} />} label="Custom domains" value={<StatusValue {...customDomains} />} />
        </DiagramCard>
      </div>
    </div>
  );
}

function ClusterPanel({ region, compute, status, onClick }: ClusterPanelProps) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-2.5">
      <div className="px-1.5 pb-2.5 pt-1 text-[13px] text-dash-text-faded">{region}</div>
      <DiagramCard title="App cluster" icon={<HardDrives className={ICON_CLASS} />} onClick={onClick}>
        <Row icon={<HardDrives className={ICON_CLASS} />} label="Compute" value={<span className="text-[13px] text-dash-text-strong">{compute}</span>} />
        <Row icon={<Lightning className={ICON_CLASS} />} label="Status" value={<StatusValue {...status} />} />
      </DiagramCard>
    </div>
  );
}

function StaticHostingPanel({ region, status, onClick }: StaticHostingPanelProps) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-2.5">
      <div className="px-1.5 pb-2.5 pt-1 text-[13px] text-dash-text-faded">{region}</div>
      <DiagramCard title="Static hosting" icon={<HardDrive className={ICON_CLASS} />} onClick={onClick}>
        <Row
          icon={<HardDrive className={ICON_CLASS} />}
          label="Storage"
          value={<span className="text-[13px] text-dash-text-strong">Distributed object storage</span>}
        />
        <Row icon={<GlobeSimple className={ICON_CLASS} />} label="Delivery" value={<span className="text-[13px] text-dash-text-strong">Edge CDN</span>} />
        <Row icon={<Lightning className={ICON_CLASS} />} label="Status" value={<StatusValue {...status} />} />
      </DiagramCard>
    </div>
  );
}

function ScalingPanel({ configured, instances, cpu, memory, status, onClick }: ScalingPanelProps) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-2.5">
      <div className="px-1.5 pb-2.5 pt-1 text-[13px] text-dash-text-faded">Scaling</div>
      <DiagramCard title="Autoscaling" icon={<ArrowsVertical className={ICON_CLASS} />} onClick={onClick}>
        {configured ? (
          <>
            <Row icon={<Stack className={ICON_CLASS} />} label="Instances" value={<span className="text-[13px] text-dash-text-strong">{instances}</span>} />
            <Row icon={<Cpu className={ICON_CLASS} />} label="CPU target" value={<span className="text-[13px] text-dash-text-strong">{cpu}</span>} />
            <Row icon={<Memory className={ICON_CLASS} />} label="Memory target" value={<span className="text-[13px] text-dash-text-strong">{memory}</span>} />
            {status ? <Row icon={<Lightning className={ICON_CLASS} />} label="Status" value={<StatusValue {...status} />} /> : null}
          </>
        ) : (
          <div className="flex flex-col gap-2 px-3.5 py-3">
            <p className="text-[13px] leading-[1.4] text-dash-text-faded">Autoscaling isn't set up for this app yet.</p>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#4879f8]">
              Configure scaling
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        )}
      </DiagramCard>
    </div>
  );
}

type WithHover<T> = T & { onHover: (hovered: boolean) => void; [key: string]: unknown };

function NetworkNode({ data }: NodeProps<Node<WithHover<NetworkPanelProps>>>) {
  return (
    <div
      className="pointer-events-auto w-[340px]"
      onMouseEnter={() => data.onHover(true)}
      onMouseLeave={() => data.onHover(false)}
    >
      <NetworkPanel {...data} />
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
}

function ClusterNode({ data }: NodeProps<Node<WithHover<ClusterPanelProps>>>) {
  return (
    <div
      className="pointer-events-auto w-[300px]"
      onMouseEnter={() => data.onHover(true)}
      onMouseLeave={() => data.onHover(false)}
    >
      <ClusterPanel {...data} />
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
}

function StaticHostingNode({ data }: NodeProps<Node<WithHover<StaticHostingPanelProps>>>) {
  return (
    <div
      className="pointer-events-auto w-[320px]"
      onMouseEnter={() => data.onHover(true)}
      onMouseLeave={() => data.onHover(false)}
    >
      <StaticHostingPanel {...data} />
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
}

function ScalingNode({ data }: NodeProps<Node<WithHover<ScalingPanelProps>>>) {
  return (
    <div
      className="pointer-events-auto w-[300px]"
      onMouseEnter={() => data.onHover(true)}
      onMouseLeave={() => data.onHover(false)}
    >
      <ScalingPanel {...data} />
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = { network: NetworkNode, cluster: ClusterNode, staticHosting: StaticHostingNode, scaling: ScalingNode };

function RegionPill({ region }: { region: string }) {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-[6px] bg-dash-bg-elevated px-2.5 py-1.5 text-xs text-dash-text-faded">
      <MapPin className="size-3.5 text-dash-text-extra-faded" />
      {region}
    </div>
  );
}

function isDefaultDomain(domain: { name: string; isDefault?: boolean }): boolean {
  if (domain.isDefault === true) return true;
  const name = domain.name.toLowerCase();
  return name.endsWith(".brimble.app") || name.endsWith(".brimble.io");
}

function buildStatus(project: Project): { label: string; tone: Tone } {
  const status = (project.status ?? "").toUpperCase();
  const relative = project.updatedAt ? formatRelativeTime(project.updatedAt) : "";
  if (["ACTIVE", "RUNNING", "LIVE", "SUCCESS"].includes(status)) return { label: "Running", tone: "green" };
  if (["BUILDING", "DEPLOYING", "QUEUED", "PENDING"].includes(status)) return { label: "Deploying", tone: "blue" };
  if (["SLEEPING", "IDLE", "STOPPED", "PAUSED"].includes(status)) {
    return { label: relative ? `Sleeping · ${relative}` : "Sleeping", tone: "amber" };
  }
  if (["FAILED", "ERROR", "CRASHED"].includes(status)) return { label: "Error", tone: "red" };
  return { label: status ? status.charAt(0) + status.slice(1).toLowerCase() : "Unknown", tone: "gray" };
}

function buildCompute(project: Project): string {
  const parts: string[] = [];
  if (project.specs?.memory) parts.push(`${project.specs.memory} GB`);
  if (project.specs?.cpu) parts.push(`${project.specs.cpu} vCPU`);
  return parts.length ? parts.join(" · ") : "Flex";
}

export function InfrastructureDiagram({
  project,
  networking,
  scaling,
  projectId,
  workspace,
}: {
  project: Project;
  networking: NetworkSettings | null;
  scaling?: ScalingGroup | null;
  projectId: string;
  workspace?: string;
}) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [networkDrawerOpen, setNetworkDrawerOpen] = useState(false);
  const [edgeHot, setEdgeHot] = useState(false);
  const backendProject = project.id || projectId;
  const staticProject = isStaticProject(project);

  useEffect(() => setMounted(true), []);

  const panelData = useMemo(() => {
    const domains = project.domains ?? [];
    const cloudDomain = domains.find(isDefaultDomain)?.name;
    const customCount = domains.filter((d) => !isDefaultDomain(d)).length;

    const ddos = networking?.firewall?.underAttackMode
      ? { label: "Under attack", tone: "amber" as Tone }
      : { label: "Active", tone: "green" as Tone };
    const cdn =
      !networking || networking.cloudflare?.lastSyncedAt
        ? { label: "Enabled", tone: "green" as Tone }
        : { label: "Pending", tone: "gray" as Tone };
    const edgeCaching = networking?.cache?.bypassCache
      ? { label: "Bypassed", tone: "gray" as Tone }
      : { label: "Enabled", tone: "green" as Tone };

    const network: NetworkPanelProps = {
      ddos,
      cdn,
      edgeCaching,
      cloudDomain,
      customDomains: customCount > 0 ? { label: `${customCount} connected`, tone: "green" } : { label: "Not connected", tone: "gray" },
      onEdgeClick: () => setNetworkDrawerOpen(true),
      onDomainsClick: () => navigate({ to: "/projects/$projectId/domains", params: { projectId }, search: (prev) => prev }),
    };

    const cluster: ClusterPanelProps = {
      region: project.region || "Region",
      compute: buildCompute(project),
      status: buildStatus(project),
      onClick: () => navigate({ to: "/projects/$projectId/configuration", params: { projectId }, search: (prev) => prev }),
    };

    const staticHosting: StaticHostingPanelProps = {
      region: project.region || "Global edge",
      status: buildStatus(project),
      onClick: () => navigate({ to: "/projects/$projectId/configuration", params: { projectId }, search: (prev) => prev }),
    };

    const scalingPanel: ScalingPanelProps = scaling
      ? {
          configured: true,
          instances: `${scaling.minContainers}–${scaling.maxContainers}`,
          cpu: `${scaling.maxCpuThreshold}%`,
          memory: `${scaling.maxMemoryThreshold}%`,
          status: scaling.active ? { label: "Active", tone: "green" } : { label: "Paused", tone: "gray" },
          onClick: () => navigate({ to: "/scaling", search: { workspace } }),
        }
      : {
          configured: false,
          onClick: () => navigate({ to: "/scaling", search: { workspace } }),
        };

    return { network, cluster, staticHosting, scaling: scalingPanel };
  }, [project, networking, scaling, projectId, workspace, navigate]);

  const nodes = useMemo<Node[]>(() => {
    const networkNode = { id: "network", type: "network", position: { x: 0, y: 0 }, data: { ...panelData.network, onHover: setEdgeHot } };
    if (staticProject) {
      return [
        networkNode,
        { id: "static-hosting", type: "staticHosting", position: { x: 450, y: 0 }, data: { ...panelData.staticHosting, onHover: setEdgeHot } },
      ];
    }

    return [
      networkNode,
      { id: "cluster", type: "cluster", position: { x: 450, y: -40 }, data: { ...panelData.cluster, onHover: setEdgeHot } },
      { id: "scaling", type: "scaling", position: { x: 450, y: 200 }, data: { ...panelData.scaling, onHover: setEdgeHot } },
    ];
  }, [panelData, staticProject]);

  const edges = useMemo<Edge[]>(() => {
    const edgeStyle = {
      stroke: edgeHot ? "#4879f8" : "var(--dash-border)",
      strokeWidth: edgeHot ? 2 : 1.5,
      strokeDasharray: "5 4",
    };
    if (staticProject) {
      return [{ id: "network-static-hosting", source: "network", target: "static-hosting", type: "smoothstep", animated: edgeHot, style: edgeStyle }];
    }

    return [
      { id: "network-cluster", source: "network", target: "cluster", type: "smoothstep", animated: edgeHot, style: edgeStyle },
      { id: "cluster-scaling", source: "cluster", target: "scaling", type: "smoothstep", animated: edgeHot, style: edgeStyle },
    ];
  }, [edgeHot, staticProject]);

  const drawer = (
    <NetworkSettingsDrawer open={networkDrawerOpen} onOpenChange={setNetworkDrawerOpen} projectId={backendProject} workspace={workspace} />
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <NetworkPanel {...panelData.network} />
        {staticProject ? (
          <StaticHostingPanel {...panelData.staticHosting} />
        ) : (
          <>
            <ClusterPanel {...panelData.cluster} />
            <ScalingPanel {...panelData.scaling} />
          </>
        )}
        {drawer}
      </div>
    );
  }

  return (
    <div className="infra-diagram relative h-full w-full bg-dash-bg">
      {mounted ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={theme === Theme.Dark ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 0.9 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={false}
          preventScrolling={false}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          style={{ background: "var(--dash-bg)" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color="var(--dash-border)" />
        </ReactFlow>
      ) : null}

      <RegionPill region={project.region || "Region"} />
      {drawer}
    </div>
  );
}

// ──────────────────────────── Database infrastructure ────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function buildEngine(project: Project): string {
  const raw = project.dbImage?.name || project.framework || "Database";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

interface DatabasePanelProps {
  region: string;
  engine: string;
  compute: string;
  storage: string;
  status: { label: string; tone: Tone };
  onClick: () => void;
}

interface ConnectionPanelProps {
  host: string;
  port: string;
}

interface BackupsPanelProps {
  lastBackup: string;
  size: string;
  onClick: () => void;
}

function DatabasePanel({ region, engine, compute, storage, status, onClick }: DatabasePanelProps) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-2.5">
      <div className="px-1.5 pb-2.5 pt-1 text-[13px] text-dash-text-faded">{region}</div>
      <DiagramCard title="Database" icon={<Database className={ICON_CLASS} />} onClick={onClick}>
        <Row icon={<Cube className={ICON_CLASS} />} label="Engine" value={<span className="text-[13px] text-dash-text-strong">{engine}</span>} />
        <Row icon={<Cpu className={ICON_CLASS} />} label="Compute" value={<span className="text-[13px] text-dash-text-strong">{compute}</span>} />
        <Row icon={<HardDrive className={ICON_CLASS} />} label="Storage" value={<span className="text-[13px] text-dash-text-strong">{storage}</span>} />
        <Row icon={<Lightning className={ICON_CLASS} />} label="Status" value={<StatusValue {...status} />} />
      </DiagramCard>
    </div>
  );
}

function ConnectionPanel({ host, port }: ConnectionPanelProps) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-2.5">
      <DiagramCard title="Connection" icon={<PlugsConnected className={ICON_CLASS} />}>
        <Row
          icon={<GlobeSimple className={ICON_CLASS} />}
          label="Host"
          value={
            <SimpleTooltip content={host}>
              <span className="block max-w-[150px] truncate font-mono text-xs text-dash-text-strong">{host}</span>
            </SimpleTooltip>
          }
        />
        <Row icon={<Hash className={ICON_CLASS} />} label="Port" value={<span className="font-mono text-[13px] text-dash-text-strong">{port}</span>} />
      </DiagramCard>
    </div>
  );
}

function BackupsPanel({ lastBackup, size, onClick }: BackupsPanelProps) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-2.5">
      <DiagramCard title="Backups" icon={<ClockCounterClockwise className={ICON_CLASS} />} onClick={onClick}>
        <Row icon={<Clock className={ICON_CLASS} />} label="Last backup" value={<span className="text-[13px] text-dash-text-strong">{lastBackup}</span>} />
        <Row icon={<HardDrive className={ICON_CLASS} />} label="Size" value={<span className="text-[13px] text-dash-text-strong">{size}</span>} />
      </DiagramCard>
    </div>
  );
}

function DatabaseNode({ data }: NodeProps<Node<WithHover<DatabasePanelProps>>>) {
  return (
    <div
      className="pointer-events-auto w-[320px]"
      onMouseEnter={() => data.onHover(true)}
      onMouseLeave={() => data.onHover(false)}
    >
      <DatabasePanel {...data} />
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
}

function ConnectionNode({ data }: NodeProps<Node<WithHover<ConnectionPanelProps>>>) {
  return (
    <div
      className="pointer-events-auto w-[280px]"
      onMouseEnter={() => data.onHover(true)}
      onMouseLeave={() => data.onHover(false)}
    >
      <ConnectionPanel {...data} />
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
}

function BackupsNode({ data }: NodeProps<Node<WithHover<BackupsPanelProps>>>) {
  return (
    <div
      className="pointer-events-auto w-[280px]"
      onMouseEnter={() => data.onHover(true)}
      onMouseLeave={() => data.onHover(false)}
    >
      <BackupsPanel {...data} />
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
}

const dbNodeTypes = { database: DatabaseNode, connection: ConnectionNode, backups: BackupsNode };

export function DatabaseInfrastructureDiagram({ project, projectId }: { project: Project; projectId: string }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [edgeHot, setEdgeHot] = useState(false);
  const [conn, setConn] = useState<{ host: string; port: string } | null>(null);
  const active = (project.status ?? "").toUpperCase() === "ACTIVE";
  const connectionUri = project.connectionUri;
  const decryptConnectionUri = useServerFn(decryptDatabaseConnectionUriServerFn as any) as (args: {
    data: { encryptedConnectionUri: string };
  }) => Promise<{ connectionUri: string }>;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    if (!active || !connectionUri) return;
    decryptConnectionUri({ data: { encryptedConnectionUri: connectionUri } })
      .then((result) => {
        if (cancelled) return;
        try {
          const url = new URL(result.connectionUri);
          setConn({ host: url.hostname, port: url.port });
        } catch {
          /* ignore malformed uri */
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active, connectionUri, decryptConnectionUri]);

  const panelData = useMemo(() => {
    const database: DatabasePanelProps = {
      region: project.region || "Region",
      engine: buildEngine(project),
      compute: buildCompute(project),
      storage: project.specs?.storage ? `${project.specs.storage} GB` : "—",
      status: buildStatus(project),
      onClick: () => navigate({ to: "/projects/$projectId/configuration", params: { projectId }, search: (prev) => prev }),
    };
    const connection: ConnectionPanelProps = { host: conn?.host || "—", port: conn?.port || "—" };
    const backups: BackupsPanelProps = {
      lastBackup: project.lastBackup ? formatRelativeTime(project.lastBackup) : "None",
      size: project.backupSize != null ? formatBytes(project.backupSize) : "—",
      onClick: () => navigate({ to: "/projects/$projectId/configuration", params: { projectId }, search: (prev) => prev }),
    };
    return { database, connection, backups };
  }, [project, conn, projectId, navigate]);

  const nodes = useMemo<Node[]>(
    () => [
      { id: "database", type: "database", position: { x: 0, y: 0 }, data: { ...panelData.database, onHover: setEdgeHot } },
      { id: "connection", type: "connection", position: { x: 420, y: 0 }, data: { ...panelData.connection, onHover: setEdgeHot } },
      { id: "backups", type: "backups", position: { x: 420, y: 160 }, data: { ...panelData.backups, onHover: setEdgeHot } },
    ],
    [panelData],
  );

  const edges = useMemo<Edge[]>(() => {
    const edgeStyle = {
      stroke: edgeHot ? "#4879f8" : "var(--dash-border)",
      strokeWidth: edgeHot ? 2 : 1.5,
      strokeDasharray: "5 4",
    };
    return [
      { id: "db-connection", source: "database", target: "connection", type: "smoothstep", animated: edgeHot, style: edgeStyle },
      { id: "db-backups", source: "database", target: "backups", type: "smoothstep", animated: edgeHot, style: edgeStyle },
    ];
  }, [edgeHot]);

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <DatabasePanel {...panelData.database} />
        <ConnectionPanel {...panelData.connection} />
        <BackupsPanel {...panelData.backups} />
      </div>
    );
  }

  return (
    <div className="infra-diagram relative h-full w-full bg-dash-bg">
      {mounted ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={dbNodeTypes}
          colorMode={theme === Theme.Dark ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 0.9 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={false}
          preventScrolling={false}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          style={{ background: "var(--dash-bg)" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color="var(--dash-border)" />
        </ReactFlow>
      ) : null}

      <RegionPill region={project.region || "Region"} />
    </div>
  );
}
