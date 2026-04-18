type Listener = () => void;

const listeners = new Set<Listener>();

export const eventBus = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit() {
    listeners.forEach((l) => l());
  },
};

// Cross-tab sync via storage event
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("ua_")) eventBus.emit();
  });
}
