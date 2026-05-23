import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, File as FileIcon, Folder } from "lucide-react";
import { MOCK_FILE_TREE, type FileNode } from "@/lib/sandboxes/mock-data";

function flattenFiles(node: FileNode, out: FileNode[] = []): FileNode[] {
  if (node.type === "file") out.push(node);
  if (node.children) {
    for (const child of node.children) flattenFiles(child, out);
  }
  return out;
}

function TreeRow({
  node,
  depth,
  selected,
  expanded,
  onToggle,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selected: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const isOpen = expanded.has(node.path);
  const isSelected = node.path === selected;

  if (node.type === "file") {
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={`flex w-full items-center gap-1.5 rounded-[3px] py-[3px] pr-2 text-left text-xs transition-colors ${
          isSelected
            ? "bg-dash-bg-elevated text-dash-text-strong"
            : "text-dash-text-faded hover:bg-dash-bg-elevated hover:text-dash-text-body"
        }`}
      >
        <FileIcon className="size-3 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className="flex w-full items-center gap-1 rounded-[3px] py-[3px] pr-2 text-left text-xs text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
      >
        {isOpen ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
        <Folder className="size-3 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen && node.children
        ? node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  );
}

export function SandboxFileTree() {
  const allFiles = useMemo(() => flattenFiles(MOCK_FILE_TREE), []);
  const [selected, setSelected] = useState(allFiles[0]?.path ?? "");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["/workspace", "/workspace/tools", "/workspace/output"]),
  );

  const selectedNode = allFiles.find((node) => node.path === selected);
  const lines = (selectedNode?.content ?? "").split("\n");

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[180px_1fr] gap-3">
      <div className="overflow-y-auto rounded-[4px] bg-dash-bg-elevated py-2">
        <TreeRow
          node={MOCK_FILE_TREE}
          depth={0}
          selected={selected}
          expanded={expanded}
          onToggle={toggle}
          onSelect={setSelected}
        />
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-[4px] bg-dash-bg-elevated">
        <div className="flex shrink-0 items-center justify-between px-3 py-2 text-[11px] font-mono uppercase tracking-[0.04em] text-dash-text-extra-faded">
          <span className="truncate">{selectedNode?.path ?? "—"}</span>
          <span>read-only</span>
        </div>
        <div className="flex-1 overflow-auto px-3 pb-3 font-mono text-xs leading-[1.55]">
          {selectedNode ? (
            <div className="grid grid-cols-[auto_1fr] gap-x-3">
              <div className="text-right text-dash-text-extra-faded select-none">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <div className="text-dash-text-body">
                {lines.map((line, i) => (
                  <div key={i} className="whitespace-pre">
                    {line || " "}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-dash-text-faded">Select a file</div>
          )}
        </div>
      </div>
    </div>
  );
}
