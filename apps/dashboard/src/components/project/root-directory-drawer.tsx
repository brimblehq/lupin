import { useState, useRef, useEffect } from "react";
import { Drawer } from "vaul";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface DirectoryNode {
  name: string;
  children?: DirectoryNode[];
}

const mockTree: DirectoryNode[] = [
  {
    name: "root",
    children: [
      { name: ".vscode" },
      { name: "ajax,googleapis.com" },
      { name: "assets" },
      { name: "favicon" },
      { name: "hts-cache" },
      { name: "p.typekit.net" },
      { name: "use.typekit.net" },
    ],
  },
];

/** Curved connector for a child row: vertical line + rounded corner + horizontal line */
function TreeConnector({
  parentLeft,
  isLast,
}: {
  parentLeft: number;
  isLast: boolean;
}) {
  const r = 8; // corner radius
  return (
    <>
      {/* Vertical line — from top to the curve start. For last child, stop at curve. */}
      <div
        className="absolute top-0 w-px bg-dash-border"
        style={{
          left: parentLeft,
          height: isLast ? `calc(50% - ${r}px)` : "100%",
        }}
      />
      {/* Curved corner: border-left + border-bottom with border-radius */}
      <div
        className="absolute border-b border-l border-dash-border"
        style={{
          left: parentLeft,
          top: `calc(50% - ${r}px)`,
          width: r + 6,
          height: r * 2,
          borderBottomLeftRadius: r,
        }}
      />
    </>
  );
}

function DirectoryRow({
  node,
  depth,
  selected,
  onSelect,
  isLast,
}: {
  node: DirectoryNode;
  depth: number;
  selected: string;
  onSelect: (name: string) => void;
  isLast?: boolean;
}) {
  const isSelected = selected === node.name;
  const hasChildren = node.children && node.children.length > 0;
  const showChildren = hasChildren && isSelected;
  const isChild = depth > 0;

  // The x-position of the parent's radio center (for drawing connectors)
  const parentRadioCenter = 24 + (depth - 1) * 32 + 9;

  return (
    <div className="relative">
      {/* Row */}
      <button
        onClick={() => onSelect(node.name)}
        className="relative flex w-full items-center gap-3 py-2.5 transition-colors hover:bg-dash-bg-elevated"
        style={{ paddingLeft: `${24 + depth * 32}px`, paddingRight: 16 }}
      >
        {/* Curved connector for child items */}
        {isChild && (
          <TreeConnector parentLeft={parentRadioCenter} isLast={!!isLast} />
        )}

        {/* Radio */}
        <img
          src={isSelected ? "/icons/box.svg" : "/icons/box-inactive.svg"}
          alt=""
          className="size-[18px] shrink-0"
        />

        {/* Folder icon + Name */}
        <img src="/icons/folder-open.svg" alt="" className="size-4 shrink-0" />
        <span className="flex-1 text-left text-sm text-dash-text-strong -ml-1">
          {node.name}
        </span>

        {/* Chevron if expandable */}
        {hasChildren && (
          <ChevronRight className="size-4 shrink-0 text-dash-text-extra-faded" />
        )}
      </button>

      {/* Children */}
      {showChildren &&
        node.children!.map((child, i) => (
          <DirectoryRow
            key={child.name}
            node={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            isLast={i === node.children!.length - 1}
          />
        ))}
    </div>
  );
}

export function RootDirectoryDrawer({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (path: string) => void;
}) {
  const [selected, setSelected] = useState("root");
  const [topOffset, setTopOffset] = useState(0);
  const measured = useRef(false);

  useEffect(() => {
    if (open && !measured.current) {
      const topbar = document.querySelector("[data-topbar]");
      let offset = 0;
      if (topbar) offset += topbar.getBoundingClientRect().height;
      setTopOffset(offset);
      measured.current = true;
    }
    if (!open) measured.current = false;
  }, [open]);

  function handleSelect(name: string) {
    setSelected(name);
    onSelect?.(name);
  }

  return (
    <Drawer.Root
      direction="right"
      open={open}
      onOpenChange={onOpenChange}
      noBodyStyles
      modal
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-40"
          style={{ top: topOffset }}
        />
        <Drawer.Content
          className="fixed right-0 z-50 flex w-full max-w-[500px] flex-col border-l border-dash-border bg-dash-bg shadow-[-4px_0_24px_rgba(0,0,0,0.08)] outline-none"
          style={{ top: topOffset, height: `calc(100vh - ${topOffset}px)` }}
          aria-describedby={undefined}
        >
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Header */}
            <div className="px-6 pb-4 pt-6">
              <Drawer.Title className="text-lg font-medium tracking-[-0.03px] text-dash-text-strong">
                Choose root direction
              </Drawer.Title>
              <p className="mt-1 text-sm font-light text-dash-text-extra-faded">
                Select directory to deploy
              </p>
            </div>

            {/* Github repo */}
            <div className="relative flex items-center gap-3 bg-dash-bg-elevated px-6 py-3">
              <div className="absolute bottom-0 left-[37px] h-3 w-px bg-dash-border" />
              <div className="flex size-8 items-center justify-center rounded-full border border-[#3e3e3e] bg-gradient-to-b from-[#666] to-[#1b1b1b] shadow-[0px_1px_1px_rgba(0,0,0,0.15)]">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                  <path d="M6 9v3a3 3 0 0 0 3 3" />
                </svg>
              </div>
              <span className="text-sm font-medium text-dash-text-strong">
                Github
              </span>
            </div>

            {/* Go back */}
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 px-6 py-3 text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated"
            >
              <ArrowLeft className="size-4" />
              Go back
            </button>

            {/* Directory tree */}
            <div className="flex-1">
              {mockTree.map((node, i) => (
                <DirectoryRow
                  key={node.name}
                  node={node}
                  depth={0}
                  selected={selected}
                  onSelect={handleSelect}
                  isLast={i === mockTree.length - 1}
                />
              ))}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
