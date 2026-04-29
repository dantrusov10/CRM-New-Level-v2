import React from "react";

export type TabItem = {
  key: string;
  label: string;
  right?: React.ReactNode;
};

export function Tabs({
  items,
  activeKey,
  onChange,
  className,
  buttonClassName,
}: {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  buttonClassName?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-card border border-[rgba(51,215,255,0.35)] bg-[rgba(45,123,255,0.14)] p-1 shadow-[0_0_16px_rgba(51,215,255,0.18)] ${className || ""}`}>
      {items.map((t) => {
        const active = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={
              "h-9 px-3 rounded-card text-sm flex items-center gap-2 transition-colors " +
              (buttonClassName ? `${buttonClassName} ` : "") +
              (active
                ? "bg-[rgba(51,215,255,0.24)] text-primary font-medium border border-[rgba(51,215,255,0.55)] shadow-[0_0_14px_rgba(51,215,255,0.18)]"
                : "text-text2 hover:bg-[rgba(51,215,255,0.14)] hover:text-text")
            }
          >
            <span>{t.label}</span>
            {t.right}
          </button>
        );
      })}
    </div>
  );
}
