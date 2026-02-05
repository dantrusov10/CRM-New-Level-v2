import React from "react";
import clsx from "clsx";
import { Input } from "./Input";

export type ComboOption = { value: string; label: string; meta?: any };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Combobox({
  value,
  onChange,
  placeholder,
  loadOptions,
  disabled,
  className,
}: {
  value: ComboOption | null;
  onChange: (v: ComboOption | null) => void;
  placeholder?: string;
  loadOptions: (query: string) => Promise<ComboOption[]>;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<ComboOption[]>([]);
  const debounced = useDebounced(query, 200);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    loadOptions(debounced)
      .then((items) => {
        if (!alive) return;
        setOptions(items);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, debounced, loadOptions]);

  const display = open ? query : value?.label ?? "";

  return (
    <div className={clsx("relative", className)}>
      <Input
        value={display}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // allow click selection
          setTimeout(() => {
            setOpen(false);
            setQuery("");
          }, 140);
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
      />

      {open ? (
        <div className="absolute z-50 mt-1 w-full rounded-card border border-border bg-card shadow-card overflow-hidden">
          <div className="max-h-64 overflow-auto">
            {loading ? (
              <div className="px-3 py-2 text-sm text-text2">Загрузка...</div>
            ) : options.length ? (
              options.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  className={clsx(
                    "w-full text-left px-3 py-2 text-sm hover:bg-rowHover",
                    value?.value === o.value && "bg-rowSelected"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(o);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {o.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-text2">Ничего не найдено</div>
            )}
          </div>

          {value ? (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                className="text-xs text-text2 hover:text-text"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(null);
                }}
              >
                Сбросить выбор
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
