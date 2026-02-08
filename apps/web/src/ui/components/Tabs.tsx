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
}: {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-card border border-border bg-white p-1">
      {items.map((t) => {
        const active = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={
              "h-9 px-3 rounded-card text-sm flex items-center gap-2 transition-colors " +
              (active
                ? "bg-rowSelected text-primary font-medium"
                : "text-text2 hover:bg-rowHover hover:text-text")
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
