import React from "react";
import { Maximize2, ZoomIn } from "lucide-react";
import { Button } from "../../components/Button";

/** A4: 210×297 mm → ~794×1123 px при 96 DPI */
export const KP_A4_WIDTH_PX = 794;

type ZoomMode = "fit" | 75 | 100 | 125;

export function KpDocumentFrame({
  title = "Предпросмотр документа",
  subtitle,
  children,
  toolbarExtra,
  canvasAlign = "center",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  /** На холсте — лист слева, без пустого поля по центру */
  canvasAlign?: "center" | "start";
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = React.useState<ZoomMode>("fit");
  const [fitScale, setFitScale] = React.useState(1);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = 32;
      const w = el.clientWidth - pad;
      setFitScale(Math.min(1, Math.max(0.35, w / KP_A4_WIDTH_PX)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = zoom === "fit" ? fitScale : zoom / 100;

  return (
    <div className="flex flex-col h-full min-h-[480px] rounded-card border border-border overflow-hidden bg-[#3d4450]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#2a2f38] border-b border-[rgba(255,255,255,0.08)]">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white">{title}</div>
          {subtitle ? <div className="text-[11px] text-[#9ca3af] mt-0.5">{subtitle}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {toolbarExtra}
          <Button
            small
            variant="secondary"
            onClick={() => setZoom("fit")}
            title="Подогнать по ширине"
            className={zoom === "fit" ? "ring-1 ring-primary" : ""}
          >
            <Maximize2 size={14} />
          </Button>
          <Button small variant="secondary" onClick={() => setZoom(75)} className={zoom === 75 ? "ring-1 ring-primary" : ""}>
            75%
          </Button>
          <Button small variant="secondary" onClick={() => setZoom(100)} className={zoom === 100 ? "ring-1 ring-primary" : ""}>
            100%
          </Button>
          <Button small variant="secondary" onClick={() => setZoom(125)} className={zoom === 125 ? "ring-1 ring-primary" : ""} title="125%">
            <ZoomIn size={14} />
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`flex-1 overflow-auto p-4 flex items-start ${
          canvasAlign === "start" ? "justify-start" : "justify-center"
        }`}
        style={{
          background:
            "repeating-conic-gradient(#4a5060 0% 25%, #454b5a 0% 50%) 50% / 16px 16px",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: canvasAlign === "start" ? "top left" : "top center",
            marginBottom: scale < 1 ? 24 : 0,
          }}
        >
          <div
            className="shadow-[0_8px_32px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.2)]"
            style={{
              width: KP_A4_WIDTH_PX,
              minHeight: Math.round(KP_A4_WIDTH_PX * 1.414),
              background: "#fff",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
