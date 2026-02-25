import { useTagsStore } from "@/hooks/use-tags-store";

export function useTags() {
  const tags = useTagsStore((s) => s.tags);
  const loading = useTagsStore((s) => s.loading);
  const createTag = useTagsStore((s) => s.createTag);
  const deleteTag = useTagsStore((s) => s.deleteTag);
  const renameTag = useTagsStore((s) => s.renameTag);
  const updateTagColor = useTagsStore((s) => s.updateTagColor);
  const toggleTagAssignment = useTagsStore((s) => s.toggleTagAssignment);
  const getProjectCountForTag = useTagsStore((s) => s.getProjectCountForTag);

  return {
    tags,
    loading,
    createTag,
    deleteTag,
    renameTag,
    updateTagColor,
    toggleTagAssignment,
    getProjectCountForTag,
  };
}
