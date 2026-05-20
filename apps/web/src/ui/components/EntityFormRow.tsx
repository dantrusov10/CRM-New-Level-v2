import React from "react";

/** Строка формы: подпись сверху, поле снизу (без наезда в узкой колонке). */
export function EntityFormRow({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 rounded-md bg-[rgba(255,255,255,0.03)] p-1.5">
      <div className="text-xs text-text2 leading-snug break-words">{label}</div>
      <div className="min-w-0 w-full">{children}</div>
    </div>
  );
}
