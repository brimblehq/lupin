import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { motion, AnimatePresence } from "motion/react";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton } from "../shared/modal";
import { GlossyButton } from "../shared/glossy-button";
import { FolderTrashIcon } from "../shared/folder-trash-icon";
import { Spinner } from "../shared/spinner";
import { useTags } from "@/contexts/tags-context";
import { TAG_PRESET_COLORS, normalizeTagName, randomTagColor } from "@/types/tags";

const ease = [0.16, 1, 0.3, 1] as const;

interface TagManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InlineColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease }}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-3 px-2 pt-2 pb-3">
        <HexColorPicker
          color={color}
          onChange={onChange}
          style={{ width: "100%", height: 140 }}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-dash-text-extra-faded">#</span>
          <HexColorInput
            color={color}
            onChange={onChange}
            prefixed={false}
            className="w-full rounded-[4px] bg-transparent px-1.5 py-1 font-mono text-xs text-dash-text-strong outline-none ring-1 ring-dash-border focus:ring-dash-text-faded"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TAG_PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className="size-5 rounded-full border transition-transform hover:scale-110"
              style={{
                backgroundColor: preset,
                borderColor:
                  preset === color ? "currentColor" : "rgba(0,0,0,0.1)",
                boxShadow:
                  preset === color ? `0 0 0 2px ${preset}40` : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function TagManagementModal({ open, onOpenChange }: TagManagementModalProps) {
  const { tags, createTag, deleteTag, renameTag, updateTagColor } =
    useTags();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(() => randomTagColor());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // "new" = create input picker, tag id = existing tag picker
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed || creating) return;
    if (tags.some((t) => t.name === normalizeTagName(trimmed))) return;
    setCreating(true);
    try {
      await createTag(trimmed, newColor);
      setNewName("");
      setNewColor(randomTagColor());
      setColorPickerId(null);
      createInputRef.current?.focus();
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(tagId: string) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    await renameTag(tagId, trimmed);
    setEditingId(null);
  }

  return (
      <Modal open={open} onOpenChange={onOpenChange} width={420}>
        <ModalHeader title="Manage tags" description="Create, rename, and delete tags." />

        <div className="flex max-h-[300px] flex-col gap-0.5 overflow-y-auto px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tags.length === 0 && (
            <p className="py-4 text-center text-sm text-dash-text-faded">
              No tags yet. Create one below.
            </p>
          )}

          {tags.map((tag) => (
            <div key={tag.id}>
              <div className="group flex items-center gap-2 rounded-[4px] px-2 py-1.5 transition-colors hover:bg-dash-bg-elevated">
                {/* Color dot — toggle inline picker */}
                <button
                  type="button"
                  onClick={() =>
                    setColorPickerId((v) => (v === tag.id ? null : tag.id))
                  }
                  className="shrink-0"
                >
                  <span
                    className="block size-4 rounded-full border border-black/10 transition-transform hover:scale-110"
                    style={{ backgroundColor: tag.color }}
                  />
                </button>

                {/* Name — inline edit */}
                {editingId === tag.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRename(tag.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(tag.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 rounded-[4px] bg-transparent px-1 text-sm text-dash-text-strong outline-none ring-1 ring-dash-border focus:ring-dash-text-faded"
                  />
                ) : (
                  <span className="flex-1 truncate text-sm text-dash-text-strong">
                    {tag.name}
                  </span>
                )}

                {/* Actions */}
                <button
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditingName(tag.name);
                  }}
                  className="shrink-0 text-dash-text-extra-faded opacity-0 transition-opacity hover:text-dash-text-faded group-hover:opacity-100"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  disabled={deletingId === tag.id}
                  onClick={async () => {
                    setDeletingId(tag.id);
                    await deleteTag(tag.id);
                    setDeletingId(null);
                  }}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                >
                  {deletingId === tag.id ? (
                    <Spinner size="size-3.5" className="text-dash-text-extra-faded" />
                  ) : (
                    <FolderTrashIcon className="size-3.5" />
                  )}
                </button>
              </div>

              {/* Inline color picker — expands below the row */}
              <AnimatePresence>
                {colorPickerId === tag.id && (
                  <InlineColorPicker
                    color={tag.color}
                    onChange={(c) => updateTagColor(tag.id, c)}
                  />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Create input */}
        <div className="border-t border-dash-border-soft">
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() =>
                setColorPickerId((v) => (v === "new" ? null : "new"))
              }
              className="shrink-0"
            >
              <span
                className="block size-4 rounded-full border border-black/10 transition-transform hover:scale-110"
                style={{ backgroundColor: newColor }}
              />
            </button>
            <input
              ref={createInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="New tag name..."
              className="flex-1 bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-[#9ca3af]"
            />
            <GlossyButton
              variant="black"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="h-[32px] shrink-0 px-3.5 text-xs"
            >
              {creating ? <Spinner size="size-3.5" /> : "Create"}
            </GlossyButton>
          </div>

          <AnimatePresence>
            {colorPickerId === "new" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3 px-4 pb-3">
                  <HexColorPicker
                    color={newColor}
                    onChange={setNewColor}
                    style={{ width: "100%", height: 140 }}
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dash-text-extra-faded">#</span>
                    <HexColorInput
                      color={newColor}
                      onChange={setNewColor}
                      prefixed={false}
                      className="w-full rounded-[4px] bg-transparent px-1.5 py-1 font-mono text-xs text-dash-text-strong outline-none ring-1 ring-dash-border focus:ring-dash-text-faded"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {TAG_PRESET_COLORS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNewColor(preset)}
                        className="size-5 rounded-full border transition-transform hover:scale-110"
                        style={{
                          backgroundColor: preset,
                          borderColor:
                            preset === newColor
                              ? "currentColor"
                              : "rgba(0,0,0,0.1)",
                          boxShadow:
                            preset === newColor
                              ? `0 0 0 2px ${preset}40`
                              : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ModalFooter>
          <div />
          <ModalCancelButton onClick={() => onOpenChange(false)} />
        </ModalFooter>
      </Modal>
  );
}
