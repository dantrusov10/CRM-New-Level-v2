const RELOAD_FLAG = "crm_chunk_reload_v1";

/** Ошибка загрузки code-split чанка после нового деплоя (старый index.html → новые хеши в /assets). */
export function isChunkLoadError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err);
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    /ChunkLoadError/i.test(msg)
  );
}

/** Один автоматический reload за сессию, чтобы подтянуть свежий index.html и чанки. */
export function reloadOnceForNewDeploy(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    /* private mode */
  }
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}

export function setupChunkReloadListeners(): void {
  window.addEventListener("vite:preloadError", (ev) => {
    ev.preventDefault();
    reloadOnceForNewDeploy();
  });

  window.addEventListener("unhandledrejection", (ev) => {
    if (!isChunkLoadError(ev.reason)) return;
    ev.preventDefault();
    reloadOnceForNewDeploy();
  });
}

export function lazyImportWithReload<T>(factory: () => Promise<T>): () => Promise<T> {
  return () =>
    factory().catch((err) => {
      if (isChunkLoadError(err) && reloadOnceForNewDeploy()) {
        return new Promise<T>(() => {
          /* страница перезагружается */
        });
      }
      throw err;
    });
}
