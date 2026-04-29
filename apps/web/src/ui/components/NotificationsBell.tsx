import React from "react";
import { Bell, CheckCircle2, Sparkles } from "lucide-react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { getAuthUser } from "../../lib/pb";
import { useMyTasksForBell, useRecentAiInsightsForBell, useSetTaskDone } from "../data/hooks";
import type { AiInsight, TaskItem, Deal } from "../../lib/types";

type PopupAlert =
  | { id: string; kind: "task"; title: string; subtitle: string; dealId?: string }
  | { id: string; kind: "ai"; title: string; subtitle: string; dealId?: string };

export function NotificationsBell() {
  const user = getAuthUser();
  const nav = useNavigate();
  const [open, setOpen] = React.useState(false);
  const bellQ = useMyTasksForBell({ userId: user?.id || "" });
  const aiBellQ = useRecentAiInsightsForBell({ windowHours: 72 });
  const setDoneM = useSetTaskDone();
  const [alerts, setAlerts] = React.useState<PopupAlert[]>([]);

  const tasks = (bellQ.data || []).filter((t) => !t.is_done);
  const now = dayjs();
  const overdue = tasks.filter((t) => dayjs(t.due_at).isBefore(now));
  const upcoming = tasks.filter((t) => !dayjs(t.due_at).isBefore(now));
  const aiItems = (aiBellQ.data || []) as Array<
    AiInsight & { expand?: { deal_id?: { id?: string; title?: string } } }
  >;
  const unseenAi = React.useMemo(() => {
    const seen = new Set<string>(
      JSON.parse(localStorage.getItem("nwlvl_seen_ai_insights") || "[]") as string[],
    );
    return aiItems.filter((x) => !seen.has(String(x.id)));
  }, [aiItems]);
  const badge = overdue.length + unseenAi.length;

  React.useEffect(() => {
    const dueSoon = tasks.filter((t) => {
      const d = dayjs(t.due_at);
      return d.isAfter(now) && d.diff(now, "minute") <= 15;
    });
    if (!dueSoon.length) return;
    const notified = new Set<string>(
      JSON.parse(localStorage.getItem("nwlvl_notified_task_ids") || "[]") as string[],
    );
    const fresh = dueSoon.filter((t) => !notified.has(String(t.id)));
    if (!fresh.length) return;
    setAlerts((prev) => [
      ...prev,
      ...fresh.slice(0, 3).map((t) => ({
        id: `task:${t.id}`,
        kind: "task" as const,
        title: "Скоро дедлайн задачи",
        subtitle: t.title || "Открой задачу и обнови статус",
        dealId: t.deal_id || (t as TaskItem & { expand?: { deal_id?: { id?: string } } }).expand?.deal_id?.id,
      })),
    ]);
    fresh.forEach((t) => notified.add(String(t.id)));
    localStorage.setItem("nwlvl_notified_task_ids", JSON.stringify(Array.from(notified).slice(-300)));
  }, [tasks, now]);

  React.useEffect(() => {
    if (!unseenAi.length) return;
    setAlerts((prev) => [
      ...prev,
      ...unseenAi.slice(0, 3).map((x) => ({
        id: `ai:${x.id}`,
        kind: "ai" as const,
        title: "AI-исследование завершено",
        subtitle:
          x.expand?.deal_id?.title ||
          (x.deal_id ? `Сделка ${x.deal_id}` : "Открой карточку сделки"),
        dealId: x.deal_id || x.expand?.deal_id?.id,
      })),
    ]);
    const seen = new Set<string>(
      JSON.parse(localStorage.getItem("nwlvl_seen_ai_insights") || "[]") as string[],
    );
    unseenAi.forEach((x) => seen.add(String(x.id)));
    localStorage.setItem("nwlvl_seen_ai_insights", JSON.stringify(Array.from(seen).slice(-500)));
  }, [unseenAi]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest?.("[data-bell-root]")) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" data-bell-root>
      <button
        className="ui-btn ui-icon-btn relative"
        title={badge ? `Задачи: просрочено ${badge}` : "Задачи"}
        aria-label="Задачи"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {badge ? (
          <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[360px] rounded-card border border-border bg-[rgba(15,23,42,0.96)] backdrop-blur-xl shadow-2xl p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Уведомления</div>
            <button
              className="text-xs muted hover:opacity-90"
              onClick={() => {
                setOpen(false);
                nav("/calendar");
              }}
            >
              Открыть календарь
            </button>
          </div>

          {bellQ.isLoading || aiBellQ.isLoading ? (
            <div className="text-sm muted">Загрузка…</div>
          ) : !tasks.length && !aiItems.length ? (
            <div className="text-sm muted">Нет новых уведомлений.</div>
          ) : (
            <div className="crm-scrollbar grid gap-2 max-h-[420px] overflow-y-auto overflow-x-hidden pr-1">
              {unseenAi.length ? (
                <div className="text-xs font-bold text-info mt-1">AI завершено</div>
              ) : null}
              {unseenAi.slice(0, 15).map((x) => (
                <div key={`ai-${x.id}`} className="rounded-card border border-[rgba(80,190,255,0.30)] bg-[rgba(80,190,255,0.12)] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs muted">{dayjs(x.created || x.created_at).format("DD.MM.YYYY HH:mm")}</div>
                      <div className="text-sm font-semibold mt-1 whitespace-pre-wrap">AI-исследование завершено</div>
                      <button
                        className="text-xs text-primary underline mt-1 block truncate max-w-[280px]"
                        onClick={() => {
                          if (x.deal_id) nav(`/deals/${x.deal_id}`);
                          setOpen(false);
                        }}
                        title={x.expand?.deal_id?.title || x.deal_id}
                      >
                        {x.expand?.deal_id?.title || `Сделка ${x.deal_id || "—"}`}
                      </button>
                    </div>
                    <Sparkles size={16} className="text-info mt-1" />
                  </div>
                </div>
              ))}

              {overdue.length ? (
                <div className="text-xs font-bold text-danger mt-1">Просроченные</div>
              ) : null}
              {overdue.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onOpenDeal={(dealId) => {
                    if (dealId) nav(`/deals/${dealId}`);
                    setOpen(false);
                  }}
                  onDone={async () => {
                    await setDoneM.mutateAsync({ id: t.id, is_done: true }).catch(() => null);
                  }}
                />
              ))}

              {upcoming.length ? (
                <div className="text-xs font-bold muted mt-2">Ближайшие</div>
              ) : null}
              {upcoming.slice(0, 20).map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onOpenDeal={(dealId) => {
                    if (dealId) nav(`/deals/${dealId}`);
                    setOpen(false);
                  }}
                  onDone={async () => {
                    await setDoneM.mutateAsync({ id: t.id, is_done: true }).catch(() => null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
      {!!alerts.length ? (
        <div className="fixed bottom-5 right-5 z-[70] grid gap-2 w-[340px]">
          {alerts.slice(0, 3).map((a) => (
            <button
              key={a.id}
              className={`text-left rounded-card border p-3 shadow-xl ${
                a.kind === "ai"
                  ? "border-[rgba(80,190,255,0.45)] bg-[rgba(15,23,42,0.96)]"
                  : "border-[rgba(245,158,11,0.45)] bg-[rgba(15,23,42,0.96)]"
              }`}
              onClick={() => {
                setAlerts((prev) => prev.filter((x) => x.id !== a.id));
                if (a.dealId) nav(`/deals/${a.dealId}`);
              }}
            >
              <div className="text-xs text-text2">{a.kind === "ai" ? "AI уведомление" : "Задача"}</div>
              <div className="text-sm font-semibold mt-1">{a.title}</div>
              <div className="text-xs mt-1 text-text2">{a.subtitle}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  onOpenDeal,
  onDone,
}: {
  task: TaskItem & { expand?: { deal_id?: Pick<Deal, "id" | "title"> } };
  onOpenDeal: (dealId?: string) => void;
  onDone: () => void;
}) {
  const due = dayjs(task.due_at);
  const isOverdue = due.isBefore(dayjs());
  const dealId = task.deal_id || task.expand?.deal_id?.id;
  const dealTitle = task.expand?.deal_id?.title;
  return (
    <div className={`rounded-card border border-[rgba(255,255,255,0.12)] p-2 ${isOverdue ? "bg-[rgba(239,68,68,0.10)]" : "bg-[rgba(255,255,255,0.04)]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs muted">{due.format("DD.MM.YYYY HH:mm")}</div>
          <div className="text-sm font-semibold mt-1 whitespace-pre-wrap">{task.title}</div>
          {dealTitle ? (
            <button
              className="text-xs text-primary underline mt-1 block truncate max-w-[280px]"
              onClick={() => onOpenDeal(dealId)}
              title={dealTitle}
            >
              {dealTitle}
            </button>
          ) : null}
        </div>
        <button
          className="ui-btn ui-icon-btn"
          title="Отметить выполненным"
          onClick={onDone}
          aria-label="Выполнено"
        >
          <CheckCircle2 size={18} />
        </button>
      </div>
    </div>
  );
}
