import React from "react";
import { KP_ALL_FONT_OPTIONS } from "./kpFontCatalog";
import type { KpFontFamilyId } from "./types";

const GROUPS = ["Веб-шрифты (Fontsource)", "Sans", "Display", "Serif", "Mono", "Системные", "Система"];

export function KpFontSelect({
  value,
  onChange,
  label = "Шрифт документа",
  allowEmpty,
  emptyLabel = "Как в документе",
}: {
  value?: string;
  onChange: (id: KpFontFamilyId | string) => void;
  label?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const byGroup = React.useMemo(() => {
    const map = new Map<string, typeof KP_ALL_FONT_OPTIONS>();
    for (const f of KP_ALL_FONT_OPTIONS) {
      const g = f.group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return map;
  }, []);

  const orderedGroups = GROUPS.filter((g) => byGroup.has(g)).concat(
    [...byGroup.keys()].filter((g) => !GROUPS.includes(g)),
  );

  return (
    <div>
      <div className="text-xs text-text2 mb-1">{label}</div>
      <select
        className="w-full rounded-card border border-border bg-white px-3 py-2 text-sm text-[#111] cursor-pointer"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: KP_ALL_FONT_OPTIONS.find((f) => f.id === value)?.stack,
        }}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {orderedGroups.map((group) => (
          <optgroup key={group} label={group}>
            {(byGroup.get(group) || []).map((f) => (
              <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="text-[10px] text-text2 mt-1">
        {KP_ALL_FONT_OPTIONS.length} гарнитур в списке (Fontsource + Arial, Times, Georgia и др.).
      </p>
    </div>
  );
}
