import React from "react";
import dayjs from "dayjs";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import { getAuthUser } from "../../lib/pb";
import { useMyTasksInRange } from "../data/hooks";
import { useNavigate } from "react-router-dom";

type ViewMode = "day" | "workweek";

function startOfWorkweek(d: dayjs.Dayjs) {
  // Monday as first day
  const dow = (d.day() + 6) % 7; // Mon=0
  return d.subtract(dow, "day").startOf("day");
}

export function CalendarPage() {
  const user = getAuthUser();
  const nav = useNavigate();
  const [mode, setMode] = React.useState<ViewMode>("workweek");
  const [cursor, setCursor] = React.useState(dayjs());

  const range = React.useMemo(() => {
    if (mode === "day") {
      const from = cursor.startOf("day");
      const to = cursor.endOf("day");
      return { from, to, days: [from] };
    }
    const start = startOfWorkweek(cursor);
    const days = Array.from({ length: 5 }).map((_, i) => start.add(i, "day"));
    return { from: start.startOf("day"), to: start.add(4, "day").endOf("day"), days };
  }, [mode, cursor]);

  const tasksQ = useMyTasksInRange({
    userId: user?.id || "",
    fromIso: range.from.toISOString(),
    toIso: range.to.toISOString(),
  });

  const tasks = (tasksQ.data || []).filter((t: any) => !t.is_done);

  const hours = Array.from({ length: 11 }).map((_, i) => 8 + i); // 08..18

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xl font-extrabold">Календарь</div>
          <div className="text-sm muted mt-1">День / рабочая неделя · задачи менеджера</div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={mode === "day" ? "primary" : "secondary"} onClick={() => setMode("day")}>День</Button>
          <Button variant={mode === "workweek" ? "primary" : "secondary"} onClick={() => setMode("workweek")}>Рабочая неделя</Button>
          <div className="w-px h-8 bg-border mx-1" />
          <Button variant="secondary" onClick={() => setCursor((d) => d.subtract(1, mode === "day" ? "day" : "week"))}>◀</Button>
          <Button variant="secondary" onClick={() => setCursor(dayjs())}>Сегодня</Button>
          <Button variant="secondary" onClick={() => setCursor((d) => d.add(1, mode === "day" ? "day" : "week"))}>▶</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              {mode === "day"
                ? cursor.format("DD MMMM YYYY")
                : `${range.days[0].format("DD MMM")} – ${range.days[4].format("DD MMM YYYY")}`}
            </div>
            <div className="text-xs muted">Клик по задаче → перейти в сделку</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `92px repeat(${range.days.length}, minmax(220px, 1fr))`,
              }}
            >
              {/* header row */}
              <div className="sticky left-0 bg-card z-10 border-b border-border p-2 text-xs muted">Время</div>
              {range.days.map((d) => (
                <div key={d.toString()} className="border-b border-border p-2 text-xs font-bold">
                  {d.format("ddd, DD.MM")}
                </div>
              ))}

              {hours.map((h) => (
                <React.Fragment key={h}>
                  <div className="sticky left-0 bg-card z-10 border-b border-border p-2 text-xs muted">{String(h).padStart(2, "0")}:00</div>
                  {range.days.map((d) => (
                    <DayCell
                      key={`${d.toString()}-${h}`}
                      day={d}
                      hour={h}
                      tasks={tasks}
                      onOpenDeal={(dealId) => dealId && nav(`/deals/${dealId}`)}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {tasksQ.isLoading ? <div className="text-sm muted mt-3">Загрузка…</div> : null}
          {!tasksQ.isLoading && !tasks.length ? <div className="text-sm muted mt-3">На выбранный период задач нет.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function DayCell({
  day,
  hour,
  tasks,
  onOpenDeal,
}: {
  day: dayjs.Dayjs;
  hour: number;
  tasks: any[];
  onOpenDeal: (dealId?: string) => void;
}) {
  const start = day.hour(hour).minute(0).second(0);
  const end = start.add(1, "hour");
  const slotTasks = tasks
    .filter((t) => {
      const due = dayjs(t.due_at);
      return due.valueOf() >= start.valueOf() && due.valueOf() < end.valueOf();
    })
    .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));

  return (
    <div className="border-b border-border p-2 min-h-[56px]">
      {slotTasks.map((t) => {
        const due = dayjs(t.due_at).format("HH:mm");
        const dealId = t.deal_id || t.expand?.deal_id?.id;
        const dealTitle = t.expand?.deal_id?.title;
        return (
          <button
            key={t.id}
            className="w-full text-left rounded-card border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] px-2 py-1 mb-2"
            onClick={() => onOpenDeal(dealId)}
            title={dealTitle ? `${dealTitle} · ${t.title}` : t.title}
          >
            <div className="text-xs muted">{due}</div>
            <div className="text-sm font-semibold truncate">{t.title}</div>
            {dealTitle ? <div className="text-xs text-primary truncate mt-1">{dealTitle}</div> : null}
          </button>
        );
      })}
    </div>
  );
}
