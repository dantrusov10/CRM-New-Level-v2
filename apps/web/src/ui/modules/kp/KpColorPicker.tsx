import React from "react";
import { HexColorPicker } from "react-colorful";

export function KpColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {label ? <div className="text-[10px] text-text2 mb-1">{label}</div> : null}
      <button
        type="button"
        className="flex items-center gap-2 rounded-card border border-border bg-white px-2 py-1 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="h-5 w-5 rounded border border-black/10" style={{ background: value || "#000" }} />
        <span className="font-mono text-[10px]">{value}</span>
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 p-2 rounded-card border border-border bg-white shadow-lg">
          <HexColorPicker color={value || "#000000"} onChange={onChange} />
        </div>
      ) : null}
    </div>
  );
}
