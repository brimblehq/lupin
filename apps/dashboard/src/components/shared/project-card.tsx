export interface Project {
  name: string;
  slug?: string;
  id?: string;
  status?: string;
  serviceType?: string;
  commitMessage: string;
  branch: string;
  updatedAt: string;
  starred?: boolean;
  tags?: Array<{ id: string; name: string; color: string }>;
  domain?: string;
  framework?: string;
  frameworkLogo?: string;
  dbImage?: {
    image_url?: string;
    name?: string;
    [key: string]: unknown;
  } | null;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Database, ArrowLeftRight, MoreVertical } from "lucide-react";
import { getWorkspaceFromSearch } from "@/utils/topbar-navigation";
import { ProjectCardTags } from "@/components/projects/project-card-tags";
import { TagAssignmentPopover } from "@/components/projects/tag-assignment-popover";
import { StatusChip } from "@/components/shared/status-chip";
import { useTagsStore } from "@/hooks/use-tags-store";
import { TransferProjectModal } from "@/components/project/transfer-project-modal";

function normalizeProjectHostname(domain?: string): string | null {
  const raw = domain?.trim();
  if (!raw) return null;

  const normalizedInput = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(normalizedInput).hostname || null;
  } catch {
    return null;
  }
}

function buildProjectIconCandidates(project: Project): string[] {
  const candidates: string[] = [];
  const hostname = normalizeProjectHostname(project.domain);

  if (hostname) {
    candidates.push(`https://${hostname}/favicon.ico`);
  }

  if (project.frameworkLogo?.trim()) {
    candidates.push(project.frameworkLogo.trim());
  }

  return candidates;
}

function isBrimbleIconSource(src: string): boolean {
  const normalized = src.trim().toLowerCase();
  if (!normalized) return false;

  if (normalized.includes("icon_np5cdu") || normalized.includes("/images/brimble.svg") || normalized.includes("brimble-logo")) {
    return true;
  }

  try {
    const parsed = new URL(normalized, "https://brimble.io");
    const hostname = parsed.hostname;
    const pathname = parsed.pathname;

    if ((hostname.endsWith("brimble.io") || hostname.endsWith("brimble.app")) && pathname.endsWith("/favicon.ico")) {
      return true;
    }

    if (hostname.includes("res.cloudinary.com") && pathname.includes("/dashboard-assets/icon_")) {
      return true;
    }
  } catch {
    return normalized.includes("brimble");
  }

  return normalized.includes("brimble");
}

function ProjectIdentityIcon({ project }: { project: Project }) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = useMemo(() => buildProjectIconCandidates(project), [project]);

  useEffect(() => {
    setCandidateIndex(0);
  }, [project.name, project.domain, project.frameworkLogo]);

  const isDatabaseProject = project.serviceType === "database";

  if (isDatabaseProject) {
    const imageUrl = project.dbImage?.image_url as string | undefined;
    if (imageUrl) {
      const isSvgString = imageUrl.trim().startsWith("<svg") || imageUrl.includes("<svg");

      if (isSvgString) {
        return (
          <div
            className="flex size-6 shrink-0 items-center justify-center dark:invert [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: imageUrl }}
          />
        );
      }

      return (
        <img src={imageUrl} alt={project.dbImage?.name || "Database"} className="size-6 shrink-0 rounded-sm object-contain dark:invert" />
      );
    }

    return <Database className="size-6 shrink-0 text-dash-text-faded" />;
  }

  const iconSrc = candidates[candidateIndex];
  const invertInDarkMode = iconSrc ? isBrimbleIconSource(iconSrc) : false;
  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt=""
        className={`size-4 shrink-0 rounded-sm object-contain${invertInDarkMode ? " dark:invert" : ""}`}
        onError={() => setCandidateIndex((current) => current + 1)}
      />
    );
  }

  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-dash-bg-elevated text-[9px] font-semibold uppercase text-dash-text-faded">
      {project.name.charAt(0)}
    </span>
  );
}

export function ProjectCard({
  project,
  onTagsChange,
  view = "card",
}: {
  project: Project;
  onTagsChange?: (tags: Project["tags"]) => void;
  view?: "card" | "list";
}) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const workspace = getWorkspaceFromSearch({ searchStr });
  const slug = (project.slug || project.name).toLowerCase().replace(/\s+/g, "-");
  const projectRouteId = slug || project.id || project.name;
  const projectTagTargetId = project.id || slug;
  const [transferOpen, setTransferOpen] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const allTags = useTagsStore((s) => s.tags);
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>((project.tags ?? []).map((t) => t.id));
  const isDatabaseProject = project.serviceType === "database";

  useEffect(() => {
    setAssignedTagIds((project.tags ?? []).map((t) => t.id));
  }, [project.tags]);

  const projectTags = useMemo(() => {
    const initialTags = project.tags ?? [];
    const initialById = new Map(initialTags.map((t) => [t.id, t] as const));
    const globalById = new Map(allTags.map((t) => [t.id, t] as const));

    return assignedTagIds.map((id) => globalById.get(id) || initialById.get(id)).filter(Boolean) as Array<{
      id: string;
      name: string;
      color: string;
    }>;
  }, [allTags, assignedTagIds, project.tags]);

  function handleAssignedTagIdsChange(nextIds: string[]) {
    setAssignedTagIds(nextIds);

    const initialTags = project.tags ?? [];
    const initialById = new Map(initialTags.map((t) => [t.id, t] as const));
    const globalById = new Map(allTags.map((t) => [t.id, t] as const));
    const nextTags = nextIds.map((id) => globalById.get(id) || initialById.get(id)).filter(Boolean) as Array<{
      id: string;
      name: string;
      color: string;
    }>;

    onTagsChange?.(nextTags);
  }

  const kebabButton = (
    <button
      ref={dotsRef}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setTagPopoverOpen((v) => !v);
      }}
      className="shrink-0 text-dash-text-extra-faded transition-colors hover:text-dash-text-faded"
    >
      <MoreVertical className="size-4" />
    </button>
  );

  const transferButton = (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setTransferOpen(true);
      }}
      aria-label="Transfer project to workspace"
      className="shrink-0 text-dash-text-extra-faded transition-colors hover:text-dash-text-strong"
    >
      <ArrowLeftRight className="size-4" />
    </button>
  );

  if (view === "list") {
    return (
      <Link to="/projects/$projectId" params={{ projectId: projectRouteId }} search={workspace ? { workspace } : {}} className="block">
        <motion.div
          whileHover={{ scale: 1.004 }}
          whileTap={{ scale: 0.997 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="flex cursor-pointer items-center gap-3 overflow-clip rounded-[4px] border-[0.5px] border-dash-border px-3.5 py-3"
        >
          <ProjectIdentityIcon project={project} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium leading-5 tracking-[-0.02px] text-dash-text-strong">{project.name}</span>
              {project.status ? <StatusChip status={project.status} className="shrink-0 scale-[0.85] origin-left" /> : null}
            </div>
            <span className="truncate text-xs font-light leading-[18px] text-dash-text-faded">{project.commitMessage}</span>
          </div>

          <ProjectCardTags
            tags={projectTags}
            maxVisible={3}
            showLabels={false}
            className="hidden shrink-0 items-center gap-1.5 sm:flex"
          />

          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            {isDatabaseProject ? (
              <img src="/icons/database.svg" alt="" className="size-5 shrink-0" />
            ) : (
              <img src="/icons/git-circle.svg" alt="" className="size-5 shrink-0" />
            )}
            <span className="text-[13px] tracking-[-0.02px] text-dash-text-strong">From {project.branch}</span>
          </div>

          <span className="hidden shrink-0 font-mono text-xs uppercase tracking-[-0.02px] text-dash-text-extra-faded opacity-80 lg:inline">
            Updated {project.updatedAt}
          </span>

          <div className="flex shrink-0 items-center gap-1.5">
            {kebabButton}
            {transferButton}
          </div>
        </motion.div>
        <TagAssignmentPopover
          projectId={projectTagTargetId}
          anchorRef={dotsRef}
          open={tagPopoverOpen}
          onOpenChange={setTagPopoverOpen}
          assignedTagIds={projectTags.map((t) => t.id)}
          onAssignedTagIdsChange={handleAssignedTagIdsChange}
        />
        <TransferProjectModal
          open={transferOpen}
          onOpenChange={setTransferOpen}
          projectId={projectTagTargetId}
          projectName={project.name}
          currentWorkspaceSlug={workspace}
        />
      </Link>
    );
  }

  return (
    <Link to="/projects/$projectId" params={{ projectId: projectRouteId }} search={workspace ? { workspace } : {}} className="block">
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex min-h-[168px] cursor-pointer flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border"
      >
        {/* Project name + commit message */}
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-3.5 pt-3 pb-2 text-sm tracking-[-0.02px]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ProjectIdentityIcon project={project} />
              <span className="min-w-0 shrink font-medium leading-5 text-dash-text-strong">{project.name}</span>
            </div>
            {project.status ? <StatusChip status={project.status} className="shrink-0 scale-[0.92] origin-top-right" /> : null}
          </div>
          <span className="line-clamp-1 font-light leading-[22px] text-dash-text-faded">{project.commitMessage}</span>
        </div>

        <ProjectCardTags tags={projectTags} />

        {/* Branch with git icon + vertical line */}
        <div className="relative flex shrink-0 items-center gap-2 px-3 pb-1 pt-0.5">
          {/* Vertical line above icon */}
          <div className="absolute left-[21px] top-[-6px] h-[16px] w-px bg-dash-border" />
          {isDatabaseProject ? (
            <img src="/icons/database.svg" alt="" className="size-5 shrink-0" />
          ) : (
            <img src="/icons/git-circle.svg" alt="" className="size-5 shrink-0" />
          )}
          <span className="text-[13px] tracking-[-0.02px] text-dash-text-strong">From {project.branch}</span>
        </div>

        {/* Updated timestamp + star */}
        <div className="flex h-10 shrink-0 items-center justify-between border-t-[0.5px] border-dash-border px-3.5">
          <span className="font-mono text-xs uppercase leading-[18px] tracking-[-0.02px] text-dash-text-extra-faded opacity-80">
            Updated {project.updatedAt}
          </span>
          <div className="flex items-center gap-1.5">
            {kebabButton}
            {transferButton}
          </div>
        </div>
      </motion.div>
      <TagAssignmentPopover
        projectId={projectTagTargetId}
        anchorRef={dotsRef}
        open={tagPopoverOpen}
        onOpenChange={setTagPopoverOpen}
        assignedTagIds={projectTags.map((t) => t.id)}
        onAssignedTagIdsChange={handleAssignedTagIdsChange}
      />
      <TransferProjectModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        projectId={projectTagTargetId}
        projectName={project.name}
        currentWorkspaceSlug={workspace}
      />
    </Link>
  );
}
