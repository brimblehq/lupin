import { create } from "zustand";
import type { Tag } from "@/types/tags";
import { normalizeTagName, randomTagColor } from "@/types/tags";
import {
  listTagsServerFn,
  createTagServerFn,
  updateTagServerFn,
  deleteTagServerFn,
  toggleTagAssignmentServerFn,
} from "@/server/tags/actions";

const TAG_DEBUG_STORAGE_KEY = "brimble:debug:tags";

function isTagDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TAG_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function tagDebug(message: string, payload?: Record<string, unknown>) {
  if (!isTagDebugEnabled()) return;
  if (payload) {
    return;
  }
}

interface TagsState {
  tags: Tag[];
  loading: boolean;
  _workspace: string | null;
  _hydrated: boolean;
  _refreshSignal: number;

  hydrate: (tags: Tag[], workspace: string | null) => void;
  fetchTags: (workspace: string | null) => Promise<void>;
  createTag: (name: string, color?: string, workspace?: string) => Promise<Tag>;
  deleteTag: (tagId: string) => Promise<void>;
  renameTag: (tagId: string, name: string) => Promise<void>;
  updateTagColor: (tagId: string, color: string) => Promise<void>;
  toggleTagAssignment: (
    projectId: string,
    tagId: string,
  ) => Promise<{ assigned: boolean }>;
  getProjectCountForTag: (
    tagId: string,
    projects: Array<{ tags?: Array<{ id: string }> }>,
  ) => number;
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  loading: true,
  _workspace: null,
  _hydrated: false,
  _refreshSignal: 0,

  hydrate(tags, workspace) {
    set({ tags, loading: false, _workspace: workspace, _hydrated: true });
  },

  async fetchTags(workspace) {
    if (get()._hydrated && get()._workspace === workspace) return;

    const switchingWorkspace = get()._workspace !== workspace;
    if (switchingWorkspace) {
      set({ loading: true, tags: [] });
    } else {
      set({ loading: true });
    }
    try {
      const result = await (
        listTagsServerFn as unknown as (input: {
          data: { workspace?: string };
        }) => Promise<Array<{ id: string; name: string; color: string }>>
      )({
        data: { workspace: workspace ?? undefined },
      });
      set({
        tags: (result ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color || "#6366f1",
        })),
        loading: false,
        _workspace: workspace,
        _hydrated: true,
      });
    } catch {
      set({ tags: [], loading: false, _workspace: workspace, _hydrated: true });
    }
  },

  async createTag(name, color, workspace) {
    const normalized = normalizeTagName(name);
    const tagColor = color ?? randomTagColor();
    const tempId = `temp_${Date.now()}`;
    const optimistic: Tag = { id: tempId, name: normalized, color: tagColor };

    set((s) => ({ tags: [...s.tags, optimistic] }));

    try {
      const created = await (
        createTagServerFn as unknown as (input: {
          data: { workspace?: string; name: string; color: string };
        }) => Promise<{ id: string; name: string; color: string }>
      )({
        data: {
          workspace: workspace ?? get()._workspace ?? undefined,
          name: normalized,
          color: tagColor,
        },
      });

      const real: Tag = {
        id: created.id,
        name: created.name,
        color: created.color || tagColor,
      };
      set((s) => ({ tags: s.tags.map((t) => (t.id === tempId ? real : t)) }));
      return real;
    } catch {
      set((s) => ({ tags: s.tags.filter((t) => t.id !== tempId) }));
      return optimistic;
    }
  },

  async deleteTag(tagId) {
    const removed = get().tags.find((t) => t.id === tagId);
    set((s) => ({ tags: s.tags.filter((t) => t.id !== tagId) }));

    try {
      await (
        deleteTagServerFn as unknown as (input: {
          data: { tagId: string };
        }) => Promise<unknown>
      )({ data: { tagId } });
    } catch {
      if (removed) set((s) => ({ tags: [...s.tags, removed] }));
    }
  },

  async renameTag(tagId, name) {
    const normalized = normalizeTagName(name);
    const prev = get().tags.find((t) => t.id === tagId)?.name;
    set((s) => ({
      tags: s.tags.map((t) =>
        t.id === tagId ? { ...t, name: normalized } : t,
      ),
    }));

    try {
      await (
        updateTagServerFn as unknown as (input: {
          data: { tagId: string; name: string };
        }) => Promise<unknown>
      )({ data: { tagId, name: normalized } });
    } catch {
      if (prev !== undefined) {
        set((s) => ({
          tags: s.tags.map((t) => (t.id === tagId ? { ...t, name: prev } : t)),
        }));
      }
    }
  },

  async updateTagColor(tagId, color) {
    const prev = get().tags.find((t) => t.id === tagId)?.color;
    set((s) => ({
      tags: s.tags.map((t) => (t.id === tagId ? { ...t, color } : t)),
    }));

    try {
      await (
        updateTagServerFn as unknown as (input: {
          data: { tagId: string; color: string };
        }) => Promise<unknown>
      )({ data: { tagId, color } });
    } catch {
      if (prev !== undefined) {
        set((s) => ({
          tags: s.tags.map((t) => (t.id === tagId ? { ...t, color: prev } : t)),
        }));
      }
    }
  },

  async toggleTagAssignment(projectId, tagId) {
    tagDebug("toggle:start", { projectId, tagId });
    try {
      const result = await (
        toggleTagAssignmentServerFn as unknown as (input: {
          data: { tagId: string; projectId: string };
        }) => Promise<{ assigned: boolean }>
      )({ data: { tagId, projectId } });
      tagDebug("toggle:success", {
        projectId,
        tagId,
        assigned: result.assigned,
      });
      set((s) => ({ _refreshSignal: s._refreshSignal + 1 }));
      return result;
    } catch (error) {
      tagDebug("toggle:error", {
        projectId,
        tagId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  getProjectCountForTag(tagId, projects) {
    return projects.filter((p) => p.tags?.some((t) => t.id === tagId)).length;
  },
}));
