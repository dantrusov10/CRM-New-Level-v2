import React from "react";
import { cn } from "../../lib/cn";

/** Большие суммы без лимита HTML type=number (до сотен миллионов и выше). */
export function MoneyInput({
  value,
  onChange,
  className,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      className={cn("ui-input text-sm tabular-nums", className)}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const raw = e.target.value.replace(/\s/g, "").replace(",", ".");
        if (raw === "" || raw === "-" || /^-?\d*\.?\d*$/.test(raw)) onChange(raw);
      }}
    />
  );
}

export function DecimalInput({
  value,
  onChange,
  className,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return <MoneyInput value={value} onChange={onChange} className={className} placeholder={placeholder} disabled={disabled} />;
}
