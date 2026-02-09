// Human-friendly PocketBase error formatting (no raw JSON in UI)

type AnyErr = any;

function pickFieldErrors(err: AnyErr): string[] {
  const data = err?.data?.data;
  if (!data || typeof data !== "object") return [];
  const out: string[] = [];
  for (const [field, v] of Object.entries(data)) {
    const msg = (v as any)?.message;
    if (typeof msg === "string" && msg.trim()) out.push(`${field}: ${msg}`);
  }
  return out;
}

export function humanizePbError(err: AnyErr, fallback = "Не удалось выполнить операцию") {
  // PocketBase JS SDK usually throws ClientResponseError with fields:
  // status, message, data: { code, message, data: {field: {message}} }

  // 1) Explicit message from PB (but keep it short)
  const status = err?.status;
  const pbMessage = err?.data?.message || err?.message;

  // 2) Field-level validation errors
  const fieldErrors = pickFieldErrors(err);

  // 3) Common mappings
  if (status === 401) return "Нет авторизации. Перезайдите в систему.";
  if (status === 403) return "Недостаточно прав для этого действия.";
  if (status === 404) return "Ресурс не найден (возможно, изменились настройки/схема).";

  if (fieldErrors.length) return `Проверь поля: ${fieldErrors.join("; ")}`;

  if (typeof pbMessage === "string" && pbMessage.trim()) {
    // Avoid showing raw JSON / long blobs
    const m = pbMessage.replace(/\s+/g, " ").trim();
    if (m.length <= 180) return m;
  }

  return fallback;
}

export function notifyPbError(err: AnyErr, fallback?: string) {
  const msg = humanizePbError(err, fallback);
  // MVP: use native alert (guaranteed not to show JSON objects)
  // Later we can заменить на toast.
  window.alert(msg);
}
