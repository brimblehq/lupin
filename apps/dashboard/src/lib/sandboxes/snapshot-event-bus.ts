export type SnapshotEvent =
  | { type: "completed"; snapshotId: string; sizeBytes: number | null; imageTag: string | null }
  | { type: "failed"; snapshotId: string; reason: string | null };

type Listener = (event: SnapshotEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export const snapshotEventBus = {
  subscribe(sandboxId: string, fn: Listener): () => void {
    let set = listeners.get(sandboxId);
    if (!set) {
      set = new Set();
      listeners.set(sandboxId, set);
    }
    set.add(fn);

    return () => {
      const current = listeners.get(sandboxId);
      if (!current) return;
      current.delete(fn);
      if (current.size === 0) listeners.delete(sandboxId);
    };
  },

  dispatch(sandboxId: string, event: SnapshotEvent): void {
    const set = listeners.get(sandboxId);
    if (!set) return;
    for (const fn of set) {
      fn(event);
    }
  },
};
