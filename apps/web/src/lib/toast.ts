export type ToastKind = "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  durationMs?: number;
};

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn([...items]));
}

function remove(id: string) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, opts?: { title?: string; durationMs?: number }) {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const toast: ToastItem = {
    id,
    kind,
    title: opts?.title,
    message,
    durationMs: opts?.durationMs ?? (kind === "error" ? 7000 : 4500),
  };
  items = [toast, ...items].slice(0, 6);
  emit();
  window.setTimeout(() => remove(id), toast.durationMs);
  return id;
}

export const toast = {
  success: (message: string, title?: string) => push("success", message, { title }),
  error: (message: string, title?: string) => push("error", message, { title }),
  info: (message: string, title?: string) => push("info", message, { title }),
  warning: (message: string, title?: string) => push("warning", message, { title }),
  dismiss: remove,
  subscribe: (fn: Listener) => {
    listeners.add(fn);
    fn([...items]);
    return () => {
      listeners.delete(fn);
    };
  },
};
