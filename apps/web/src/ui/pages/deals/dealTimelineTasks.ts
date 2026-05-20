import dayjs from "dayjs";
import type { TimelineItem } from "../../../lib/types";
import type { ActionOutcome } from "./dealActionOutcome";
import { OUTCOME_LABELS } from "./dealActionOutcome";

export function timelinePayload(item: TimelineItem): Record<string, unknown> | null {
  return item.payload && typeof item.payload === "object" ? (item.payload as Record<string, unknown>) : null;
}

/** Задача в ленте закрыта событием task_completed с ref_timeline_id. */
export function isTimelineTaskCompleted(item: TimelineItem, all: TimelineItem[]): boolean {
  if (String(item.action || "") !== "task_created") return false;
  const id = String(item.id || "");
  if (!id) return false;
  return all.some((t) => {
    if (String(t.action || "") !== "task_completed") return false;
    const p = timelinePayload(t);
    return String(p?.ref_timeline_id || "") === id;
  });
}

export function isOpenTimelineTask(item: TimelineItem, all: TimelineItem[]): boolean {
  return String(item.action || "") === "task_created" && !isTimelineTaskCompleted(item, all);
}

export function getTaskDueAt(item: TimelineItem): dayjs.Dayjs | null {
  const p = timelinePayload(item);
  const raw = p?.due_at;
  if (!raw) return null;
  const d = dayjs(String(raw));
  return d.isValid() ? d : null;
}

export function isTaskOverdue(item: TimelineItem, all: TimelineItem[]): boolean {
  if (!isOpenTimelineTask(item, all)) return false;
  const due = getTaskDueAt(item);
  if (!due) return false;
  return due.isBefore(dayjs());
}

export function formatTaskDueLabel(item: TimelineItem): string {
  const due = getTaskDueAt(item);
  return due ? due.format("DD.MM.YYYY HH:mm") : "—";
}

export function splitTimelinePinnedOpen(items: TimelineItem[]): { pinned: TimelineItem[]; rest: TimelineItem[] } {
  const pinned = items.filter((t) => isOpenTimelineTask(t, items));
  const pinnedIds = new Set(pinned.map((t) => t.id));
  const rest = items.filter((t) => !pinnedIds.has(t.id));
  pinned.sort((a, b) => {
    const aOver = isTaskOverdue(a, items) ? 0 : 1;
    const bOver = isTaskOverdue(b, items) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    const ad = getTaskDueAt(a)?.valueOf() ?? Number.MAX_SAFE_INTEGER;
    const bd = getTaskDueAt(b)?.valueOf() ?? Number.MAX_SAFE_INTEGER;
    return ad - bd;
  });
  return { pinned, rest };
}

export function timelineItemTs(item: TimelineItem): number {
  const raw = item.timestamp || item.created;
  const d = raw ? dayjs(raw) : null;
  return d?.isValid() ? d.valueOf() : 0;
}

export function outcomeLabel(outcome: ActionOutcome): string {
  return OUTCOME_LABELS[outcome];
}
