import React from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { Button } from "../Button";
import { useMyTasksForBell, useSetTaskDone } from "../../data/hooks";
import type { TaskItem } from "../../../lib/types";

function taskDealId(t: TaskItem): string | undefined {
  return t.deal_id || t.expand?.deal_id?.id;
}

export function DashboardTodayPanel({ userId }: { userId: string }) {
  const nav = useNavigate();
  const tasksQ = useMyTasksForBell({ userId, windowHours: 72 });
  const setDoneM = useSetTaskDone();
  const now = dayjs();

  const open = (tasksQ.data || []).filter((t) => !t.is_done);
  const overdue = open.filter((t) => dayjs(t.due_at).isBefore(now, "minute"));
  const todayEnd = now.endOf("day");
  const today = open.filter((t) => {
    const d = dayjs(t.due_at);
    return !d.isBefore(now, "minute") && !d.isAfter(todayEnd);
  });
  const later = open.filter((t) => dayjs(t.due_at).isAfter(todayEnd)).slice(0, 5);

  async function complete(id: string) {
    await setDoneM.mutateAsync({ id, is_done: true });
  }

  function TaskRow({ t, tone }: { t: TaskItem; tone: "overdue" | "today" | "later" }) {
    const dealId = taskDealId(t);
    const border =
      tone === "overdue"
        ? "border-[rgba(239,68,68,0.55)] shadow-[0_0_12px_rgba(239,68,68,0.25)]"
        : tone === "today"
          ? "border-[rgba(51,215,255,0.35)]"
          : "border-[rgba(255,255,255,0.12)]";
    return (
      <div className={`rounded-[14px] border bg-[rgba(255,255,255,0.06)] p-3 ${border}`}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="text-left flex-1 min-w-0"
            onClick={() => (dealId ? nav(`/deals/${dealId}`) : nav("/calendar"))}
          >
            <div className="text-sm font-semibold truncate">{t.title || "Задача"}</div>
            <div className="text-xs text-text2 mt-0.5 flex items-center gap-1">
              <Clock size={12} />
              {dayjs(t.due_at).format("DD.MM HH:mm")}
              {t.expand?.deal_id?.title ? ` · ${t.expand.deal_id.title}` : ""}
            </div>
          </button>
          <Button
            small
            variant="secondary"
            title="Выполнено"
            onClick={() => void complete(t.id)}
            disabled={setDoneM.isPending}
          >
            <CheckCircle2 size={14} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-card p-4 neon-accent">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-extrabold">Сегодня</div>
          <div className="text-xs text-text2 mt-1">
            {overdue.length ? (
              <span className="text-danger font-semibold">Просрочено: {overdue.length}</span>
            ) : (
              "Просроченных задач нет"
            )}
            {" · "}
            На сегодня: {today.length}
          </div>
        </div>
        <Button small variant="secondary" onClick={() => nav("/calendar")}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={14} /> Календарь
          </span>
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div>
          <div className="text-xs font-bold text-danger mb-2 uppercase tracking-wide">Просрочено</div>
          <div className="space-y-2">
            {overdue.length ? overdue.slice(0, 6).map((t) => <TaskRow key={t.id} t={t} tone="overdue" />) : (
              <div className="text-xs text-text2">—</div>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-primary mb-2 uppercase tracking-wide">Сегодня</div>
          <div className="space-y-2">
            {today.length ? today.slice(0, 6).map((t) => <TaskRow key={t.id} t={t} tone="today" />) : (
              <div className="text-xs text-text2">Задач на сегодня нет</div>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-text2 mb-2 uppercase tracking-wide">Скоро</div>
          <div className="space-y-2">
            {later.length ? later.map((t) => <TaskRow key={t.id} t={t} tone="later" />) : (
              <div className="text-xs text-text2">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
