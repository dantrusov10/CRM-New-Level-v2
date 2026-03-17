// Human-friendly PocketBase error formatting (no raw JSON in UI)

type PbLikeFieldError = { message?: unknown };
type PbLikeError = {
  status?: number;
  message?: unknown;
  data?: {
    message?: unknown;
    data?: Record<string, PbLikeFieldError | undefined>;
  };
};

function pickFieldErrors(err: PbLikeError): string[] {
  const data = err?.data?.data;
  if (!data || typeof data !== "object") return [];
  const out: string[] = [];
  for (const [field, v] of Object.entries(data)) {
    const msg = v?.message;
    if (typeof msg === "string" && msg.trim()) out.push(`${field}: ${msg}`);
  }
  return out;
}

export function humanizePbError(err: unknown, fallback = "Не удалось выполнить операцию") {
  const pbErr = (err ?? {}) as PbLikeError;
  // PocketBase JS SDK usually throws ClientResponseError with fields:
  // status, message, data: { code, message, data: {field: {message}} }

  // 1) Explicit message from PB (but keep it short)
  const status = pbErr?.status;
  const pbMessage = pbErr?.data?.message || pbErr?.message;

  // 2) Field-level validation errors
  const fieldErrors = pickFieldErrors(pbErr);

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

export function notifyPbError(err: unknown, fallback?: string) {
  const msg = humanizePbError(err, fallback);
  // MVP: use native alert (guaranteed not to show JSON objects)
  // Later we can заменить на toast.
  window.alert(msg);
}
