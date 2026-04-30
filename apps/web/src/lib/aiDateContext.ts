/**
 * Общий блок контекста дат для любых вызовов ИИ из CRM.
 * Используйте при формировании prompt / payload к gateway или к LLM.
 */

export type TimelineLike = {
  timestamp?: string;
  created?: string;
  action?: string;
  comment?: string;
};

export type DealDatesLike = {
  created?: string;
  updated?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** ISO UTC «сейчас» в момент формирования запроса к ИИ. */
export function getAiRequestInstantUtcIso(): string {
  const d = new Date();
  return d.toISOString();
}

/** Дата по календарю в локали пользователя (для подписи в тексте). */
export function getAiRequestLocalDateLabel(locale = "ru-RU"): string {
  return new Date().toLocaleDateString(locale, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseEventInstant(raw: string | undefined): Date | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s) && !s.includes("T")) s = s.replace(" ", "T");
  if (s.endsWith("Z")) s = s.slice(0, -1) + "+00:00";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDayUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function formatTimelineLine(ev: TimelineLike): string | null {
  const t = parseEventInstant(ev.timestamp) ?? parseEventInstant(ev.created);
  if (!t) return null;
  const day = formatDayUtc(t);
  const action = (ev.action || "event").trim();
  const comment = (ev.comment || "").replace(/\s+/g, " ").trim();
  const clipped = comment.length > 400 ? `${comment.slice(0, 397)}…` : comment;
  return `- [${day} UTC] ${action}: ${clipped}`;
}

/**
 * Хронология для модели: новые события сверху, каждая строка с датой события.
 */
export function formatTimelineDigestForAi(
  timeline: TimelineLike[] | undefined,
  opts?: { maxLines?: number },
): string {
  const maxLines = opts?.maxLines ?? 80;
  const lines: { sort: number; text: string }[] = [];
  for (const ev of timeline || []) {
    const t = parseEventInstant(ev.timestamp) ?? parseEventInstant(ev.created);
    if (!t) continue;
    const text = formatTimelineLine(ev);
    if (!text) continue;
    lines.push({ sort: t.getTime(), text });
  }
  lines.sort((a, b) => b.sort - a.sort);
  return lines
    .slice(0, maxLines)
    .map((x) => x.text)
    .join("\n");
}

export function formatDealDatesForAi(deal: DealDatesLike | undefined): string {
  if (!deal) return "";
  const parts: string[] = [];
  const c = parseEventInstant(deal.created);
  const u = parseEventInstant(deal.updated);
  if (c) parts.push(`Сделка создана (UTC дата): ${formatDayUtc(c)}`);
  if (u) parts.push(`Сделка обновлена (UTC дата): ${formatDayUtc(u)}`);
  return parts.join("\n");
}

/** Короткая инструкция модели про даты (добавлять в system или первым user-сообщением). */
export function buildAiDateDisciplineInstructions(): string {
  return [
    "Контекст времени:",
    "- Поле request_instant_utc — это текущий момент запроса к ИИ (опорная точка «сейчас»).",
    "- В блоке «Хронология CRM» у каждой строки указана дата СОБЫТИЯ (не «сегодня»).",
    "- Сравнивай утверждения в старых комментариях с request_instant_utc и с более новыми событиями сверху списка.",
    "- Не предлагай «ждать» событие, если по датам и более свежим записям оно уже должно было произойти, пока нет явного свежего подтверждения обратного.",
  ].join("\n");
}

/**
 * Готовый текстовый блок для вставки в prompt (после system или перед пользовательским вопросом).
 */
export function buildAiDateContextEnvelope(input: {
  timeline?: TimelineLike[];
  deal?: DealDatesLike;
  requestInstantUtcIso?: string;
  maxTimelineLines?: number;
}): string {
  const requestInstantUtcIso = input.requestInstantUtcIso ?? getAiRequestInstantUtcIso();
  const localLabel = getAiRequestLocalDateLabel();
  const dealDates = formatDealDatesForAi(input.deal);
  const digest = formatTimelineDigestForAi(input.timeline, { maxLines: input.maxTimelineLines });

  const parts = [
    "### Метаданные запроса к ИИ",
    `request_instant_utc: ${requestInstantUtcIso}`,
    `request_local_calendar_hint: ${localLabel}`,
    "",
    "### Ключевые даты сущности",
    dealDates || "(нет полей created/updated)",
    "",
    "### Хронология CRM (сначала новые; дата = дата события)",
    digest || "(нет событий timeline)",
    "",
    "### Инструкция по датам",
    buildAiDateDisciplineInstructions(),
  ];
  return parts.join("\n");
}
