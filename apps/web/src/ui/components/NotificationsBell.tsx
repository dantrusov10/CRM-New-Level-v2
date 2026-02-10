import React from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { getAuthUser } from "../../lib/pb";
import { useMyTasksForBell, useSetTaskDone } from "../data/hooks";

export function NotificationsBell() {
  const user = getAuthUser();
  const nav = useNavigate();
  const [open, setOpen] = React.useState(false);
  const bellQ = useMyTasksForBell({ userId: user?.id || "" });
  const setDoneM = useSetTaskDone();

  const tasks = (bellQ.data || []).filter((t: any) => !t.is_done);
  const now = dayjs();
  const overdue = tasks.filter((t: any) => dayjs(t.due_at).isBefore(now));
  const upcoming = tasks.filter((t: any) => !dayjs(t.due_at).isBefore(now));
  const badge = overdue.length;

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
            <div className="text-sm font-semibold">Задачи</div>
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

          {bellQ.isLoading ? (
            <div className="text-sm muted">Загрузка…</div>
          ) : !tasks.length ? (
            <div className="text-sm muted">Нет задач в ближайшее время.</div>
          ) : (
            <div className="grid gap-2 max-h-[420px] overflow-auto pr-1">
              {overdue.length ? (
                <div className="text-xs font-bold text-danger mt-1">Просроченные</div>
              ) : null}
              {overdue.map((t: any) => (
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
              {upcoming.slice(0, 20).map((t: any) => (
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
    </div>
  );
}

function TaskRow({
  task,
  onOpenDeal,
  onDone,
}: {
  task: any;
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
