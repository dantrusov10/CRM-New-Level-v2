import React from "react";
import dayjs from "dayjs";
import clsx from "clsx";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(d: dayjs.Dayjs) {
  // match <input type="datetime-local"> format: YYYY-MM-DDTHH:mm
  return `${d.format("YYYY-MM-DD")}T${d.format("HH:mm")}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "ДД.ММ.ГГГГ --:--",
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [monthCursor, setMonthCursor] = React.useState(() => (value ? dayjs(value) : dayjs()).startOf("month"));

  const parsed = React.useMemo(() => {
    const d = value ? dayjs(value) : null;
    return d && d.isValid() ? d : null;
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    setMonthCursor((parsed ?? dayjs()).startOf("month"));
  }, [open, parsed]);

  const display = parsed ? parsed.format("DD.MM.YYYY HH:mm") : "";

  // calendar grid
  const start = monthCursor.startOf("week");
  const end = monthCursor.endOf("month").endOf("week");
  const days: dayjs.Dayjs[] = [];
  for (let d = start; d.isBefore(end); d = d.add(1, "day")) days.push(d);

  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = React.useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const selected = parsed ?? dayjs();
  const selDay = parsed ? parsed.format("YYYY-MM-DD") : "";
  const selHour = selected.hour();
  const selMin = selected.minute();

  function setDatePart(nextDate: dayjs.Dayjs) {
    const base = (parsed ?? dayjs()).second(0);
    const next = base.year(nextDate.year()).month(nextDate.month()).date(nextDate.date());
    onChange(toLocalInputValue(next));
  }

  function setTimePart(h: number, m: number) {
    const base = (parsed ?? dayjs()).second(0);
    const next = base.hour(h).minute(m);
    onChange(toLocalInputValue(next));
  }

  return (
    <div className={clsx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        className={clsx(
          "ui-input text-left",
          !display && "text-[rgba(255,255,255,0.6)]",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        {display || placeholder}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-[70] mt-2 w-[360px] rounded-card border border-[rgba(255,255,255,0.14)] bg-[rgba(10,20,32,0.92)] backdrop-blur-xl shadow-card overflow-hidden"
          onMouseDown={(e) => {
            // keep popover open while interacting
            e.preventDefault();
          }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(255,255,255,0.10)]">
            <div className="text-sm font-semibold">{monthCursor.format("MMMM YYYY")}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 w-8 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)]"
                onClick={() => setMonthCursor((m) => m.subtract(1, "month"))}
                title="Предыдущий месяц"
              >
                ‹
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)]"
                onClick={() => setMonthCursor((m) => m.add(1, "month"))}
                title="Следующий месяц"
              >
                ›
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr,120px]">
            {/* Calendar */}
            <div className="p-3">
              <div className="grid grid-cols-7 gap-1 text-[11px] text-[rgba(255,255,255,0.65)] mb-2">
                {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((x) => (
                  <div key={x} className="text-center">
                    {x}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const isOther = d.month() !== monthCursor.month();
                  const isSel = selDay && d.format("YYYY-MM-DD") === selDay;
                  const isToday = d.format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD");
                  return (
                    <button
                      key={d.toString()}
                      type="button"
                      className={clsx(
                        "h-9 rounded-2xl text-sm flex items-center justify-center border",
                        isSel
                          ? "border-[rgba(99,179,255,0.65)] bg-[rgba(99,179,255,0.22)]"
                          : "border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)]",
                        isOther && "opacity-40",
                        isToday && !isSel && "ring-1 ring-[rgba(255,255,255,0.18)]"
                      )}
                      onClick={() => setDatePart(d)}
                    >
                      {d.date()}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  className="text-xs text-[rgba(255,255,255,0.75)] hover:underline"
                  onClick={() => onChange("")}
                >
                  Очистить
                </button>
                <button
                  type="button"
                  className="text-xs text-[rgba(255,255,255,0.75)] hover:underline"
                  onClick={() => {
                    const now = dayjs().second(0);
                    onChange(toLocalInputValue(now));
                  }}
                >
                  Сегодня
                </button>
              </div>
            </div>

            {/* Time */}
            <div className="border-l border-[rgba(255,255,255,0.10)] p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] overflow-hidden">
                  <div className="max-h-56 overflow-auto no-scrollbar">
                    {hours.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={clsx(
                          "w-full px-2 py-1 text-sm text-left hover:bg-[rgba(255,255,255,0.10)]",
                          h === selHour && "bg-[rgba(99,179,255,0.22)]"
                        )}
                        onClick={() => setTimePart(h, selMin)}
                      >
                        {pad2(h)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] overflow-hidden">
                  <div className="max-h-56 overflow-auto no-scrollbar">
                    {minutes.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={clsx(
                          "w-full px-2 py-1 text-sm text-left hover:bg-[rgba(255,255,255,0.10)]",
                          m === selMin && "bg-[rgba(99,179,255,0.22)]"
                        )}
                        onClick={() => setTimePart(selHour, m)}
                      >
                        {pad2(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  className="h-9 px-3 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)]"
                  onClick={() => setOpen(false)}
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
