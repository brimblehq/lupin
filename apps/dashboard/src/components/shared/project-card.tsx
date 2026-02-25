export interface Project {
  name: string;
  slug?: string;
  id?: string;
  status?: string;
  commitMessage: string;
  branch: string;
  updatedAt: string;
  starred?: boolean;
  tags?: Array<{ id: string; name: string; color: string }>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Star, MoreVertical } from "lucide-react";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { ProjectCardTags } from "@/components/projects/project-card-tags";
import { TagAssignmentPopover } from "@/components/projects/tag-assignment-popover";
import { StatusChip } from "@/components/shared/status-chip";
import { useTagsStore } from "@/hooks/use-tags-store";

export function ProjectCard({
  project,
  onTagsChange,
}: {
  project: Project;
  onTagsChange?: (tags: Project["tags"]) => void;
}) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const slug = (project.slug || project.name).toLowerCase().replace(/\s+/g, "-");
  const projectId = project.id || slug;
  const [starred, setStarred] = useState(project.starred ?? false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const allTags = useTagsStore((s) => s.tags);
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>((project.tags ?? []).map((t) => t.id));

  useEffect(() => {
    setAssignedTagIds((project.tags ?? []).map((t) => t.id));
  }, [project.tags]);

  const projectTags = useMemo(() => {
    const initialTags = project.tags ?? [];
    const initialById = new Map(initialTags.map((t) => [t.id, t] as const));
    const globalById = new Map(allTags.map((t) => [t.id, t] as const));

    return assignedTagIds
      .map((id) => globalById.get(id) || initialById.get(id))
      .filter(Boolean) as Array<{ id: string; name: string; color: string }>;
  }, [allTags, assignedTagIds, project.tags]);

  function handleAssignedTagIdsChange(nextIds: string[]) {
    setAssignedTagIds(nextIds);

    const initialTags = project.tags ?? [];
    const initialById = new Map(initialTags.map((t) => [t.id, t] as const));
    const globalById = new Map(allTags.map((t) => [t.id, t] as const));
    const nextTags = nextIds
      .map((id) => globalById.get(id) || initialById.get(id))
      .filter(Boolean) as Array<{ id: string; name: string; color: string }>;

    onTagsChange?.(nextTags);
  }

  return (
    <Link
      to={withWorkspaceQuery({ pathname: `/projects/${slug}`, searchStr }) as any}
      className="block"
    >
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="flex min-h-[168px] cursor-pointer flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border"
    >
      {/* Project name + commit message */}
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-3.5 pt-3 pb-2 text-sm tracking-[-0.02px]">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 shrink font-medium leading-5 text-dash-text-strong">
            {project.name}
          </span>
          {project.status ? (
            <StatusChip status={project.status} className="shrink-0 scale-[0.92] origin-top-right" />
          ) : null}
        </div>
        <span className="line-clamp-1 font-light leading-[22px] text-dash-text-faded">
          {project.commitMessage}
        </span>
      </div>

      <ProjectCardTags tags={projectTags} />

      {/* Branch with git icon + vertical line */}
      <div className="relative flex shrink-0 items-center gap-2 px-3 pb-1 pt-0.5">
        {/* Vertical line above icon */}
        <div className="absolute left-[23px] top-[-6px] h-[16px] w-px bg-dash-border" />
        {/* Git icon */}
        <img src="/icons/git-circle.svg" alt="" className="size-6 shrink-0" />
        <span className="text-sm tracking-[-0.02px] text-dash-text-strong">
          From {project.branch}
        </span>
      </div>

      {/* Updated timestamp + star */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t-[0.5px] border-dash-border px-3.5">
        <span className="font-mono text-xs uppercase leading-[18px] tracking-[-0.02px] text-dash-text-extra-faded opacity-80">
          Updated {project.updatedAt}
        </span>
        <div className="flex items-center gap-1.5">
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
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setStarred(!starred);
            }}
            className="shrink-0 text-dash-text-extra-faded transition-colors hover:text-[#f5a623]"
          >
            <Star
              className="size-4"
              fill={starred ? "#f5a623" : "none"}
              stroke={starred ? "#f5a623" : "currentColor"}
            />
          </button>
        </div>
      </div>
    </motion.div>
    <TagAssignmentPopover
      projectId={projectId}
      anchorRef={dotsRef}
      open={tagPopoverOpen}
      onOpenChange={setTagPopoverOpen}
      assignedTagIds={projectTags.map((t) => t.id)}
      onAssignedTagIdsChange={handleAssignedTagIdsChange}
    />
    </Link>
  );
}
