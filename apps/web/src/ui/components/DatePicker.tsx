import React from "react";
import dayjs from "dayjs";
import { cn } from "../../lib/cn";

/** Value: YYYY-MM-DD (filter URL / PocketBase dates). */
export function DatePicker({
  value,
  onChange,
  placeholder = "ДД.ММ.ГГГГ",
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
  const [monthCursor, setMonthCursor] = React.useState(() =>
    value ? dayjs(value).startOf("month") : dayjs().startOf("month")
  );
  const rootRef = React.useRef<HTMLDivElement>(null);

  const parsed = React.useMemo(() => {
    const d = value ? dayjs(value) : null;
    return d && d.isValid() ? d : null;
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    setMonthCursor((parsed ?? dayjs()).startOf("month"));
  }, [open, parsed]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const start = monthCursor.startOf("week");
  const end = monthCursor.endOf("month").endOf("week");
  const days: dayjs.Dayjs[] = [];
  for (let d = start; d.isBefore(end); d = d.add(1, "day")) days.push(d);

  const selDay = parsed ? parsed.format("YYYY-MM-DD") : "";
  const display = parsed ? parsed.format("DD.MM.YYYY") : "";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "ui-input text-left w-full",
          !display && "text-[rgba(255,255,255,0.6)]",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        {display || placeholder}
      </button>

      {open ? (
        <div
          className="absolute left-0 z-[80] mt-2 w-[300px] rounded-card border border-[rgba(51,215,255,0.35)] bg-[#0f2644] shadow-[0_0_26px_rgba(51,215,255,0.2)] overflow-hidden"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(51,215,255,0.22)] bg-[rgba(45,123,255,0.12)]">
            <div className="text-sm font-semibold capitalize">{monthCursor.format("MMMM YYYY")}</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="h-8 w-8 rounded-lg border border-[rgba(51,215,255,0.28)] bg-[rgba(51,215,255,0.1)] hover:bg-[rgba(51,215,255,0.2)]"
                onClick={() => setMonthCursor((m) => m.subtract(1, "month"))}
              >
                ‹
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-lg border border-[rgba(51,215,255,0.28)] bg-[rgba(51,215,255,0.1)] hover:bg-[rgba(51,215,255,0.2)]"
                onClick={() => setMonthCursor((m) => m.add(1, "month"))}
              >
                ›
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 text-[10px] text-text2 mb-2">
              {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((x) => (
                <div key={x} className="text-center font-semibold">{x}</div>
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
                    className={cn(
                      "h-8 rounded-lg text-sm border transition-colors",
                      isSel
                        ? "border-[rgba(51,215,255,0.65)] bg-[rgba(51,215,255,0.28)] text-text font-semibold"
                        : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(51,215,255,0.12)]",
                      isOther && "opacity-35",
                      isToday && !isSel && "ring-1 ring-[rgba(51,215,255,0.35)]"
                    )}
                    onClick={() => {
                      onChange(d.format("YYYY-MM-DD"));
                      setOpen(false);
                    }}
                  >
                    {d.date()}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
              <button type="button" className="text-xs text-text2 hover:text-text" onClick={() => { onChange(""); setOpen(false); }}>
                Очистить
              </button>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  onChange(dayjs().format("YYYY-MM-DD"));
                  setOpen(false);
                }}
              >
                Сегодня
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
