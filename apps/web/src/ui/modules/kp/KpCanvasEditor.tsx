import React from "react";
import { Rnd } from "react-rnd";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Layers, Plus } from "lucide-react";
import { Button } from "../../components/Button";
import { KpPreview } from "./KpPreview";
import { KpBlockInspector } from "./KpBlockInspector";
import { KpDocumentFrame, KP_A4_WIDTH_PX } from "./KpDocumentFrame";
import {
  CANVAS_PAGE_HEIGHT,
  blocksOnCanvasPage,
  canvasPageIndices,
  defaultRectForBlock,
  ensureBlockRects,
  isCanvasLayoutMode,
  snapCanvasValue,
} from "./kpCanvasLayout";
import { blockInlineStyleCss } from "./kpBlockStyle";
import { countTemplatePages } from "./kpCanvasPages";
import { normalizePdfDesign } from "./kpDesign";
import { KP_PDF_BLOCK_META, createCustomBlock, ensurePdfBlocks } from "./kpPdfBlocks";
import type { KpInput, KpPdfBlock, KpTemplateConfig, SpecItem } from "./types";
import "./kpCanvasEditor.css";

function SortableLayer({
  block,
  selected,
  onSelect,
}: {
  block: KpPdfBlock;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const label =
    block.type === "custom" ? block.title || "Свой раздел" : KP_PDF_BLOCK_META[block.type].label;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kp-canvas-layer-item ${selected ? "is-selected" : ""} ${isDragging ? "is-dragging" : ""}`}
      onClick={onSelect}
    >
      <button type="button" className="touch-none text-text2" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <span className="truncate">{label}</span>
      {!block.enabled ? <span className="text-[9px] text-text2 ml-auto">скрыт</span> : null}
    </div>
  );
}

export function KpCanvasEditor({
  template,
  onTemplateChange,
  input,
  items,
  dealId,
}: {
  template: KpTemplateConfig;
  onTemplateChange: (next: KpTemplateConfig) => void;
  input: KpInput;
  items: SpecItem[];
  dealId: string;
}) {
  const design = normalizePdfDesign(template);
  const grid = design.canvasGridPx;
  const snap = design.canvasSnap;

  const blocks = React.useMemo(() => {
    const raw = ensurePdfBlocks(template);
    return isCanvasLayoutMode(template) ? ensureBlockRects(raw, template) : raw;
  }, [template]);

  const [pageIndex, setPageIndex] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const pageBlocks = React.useMemo(() => blocksOnCanvasPage(blocks, pageIndex), [blocks, pageIndex]);
  const pageIndices = React.useMemo(() => canvasPageIndices(blocks), [blocks]);
  const selected = blocks.find((b) => b.id === selectedId) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function setBlocks(next: KpPdfBlock[]) {
    onTemplateChange({ ...template, pdfBlocks: next });
  }

  function patchBlock(id: string, patch: Partial<KpPdfBlock>) {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function updateRect(id: string, rect: Partial<NonNullable<KpPdfBlock["rect"]>>) {
    const b = blocks.find((x) => x.id === id);
    if (!b) return;
    patchBlock(id, { rect: { ...(b.rect || { x: 0, y: 0, w: 100, pageIndex }), ...rect } });
  }

  function onLayerDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = pageBlocks.map((b) => b.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = [...pageBlocks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    const zMap = new Map(reordered.map((b, i) => [b.id, i + 1]));
    setBlocks(
      blocks.map((b) => {
        const z = zMap.get(b.id);
        if (z == null || (b.rect?.pageIndex ?? 0) !== pageIndex) return b;
        return { ...b, rect: { ...(b.rect || { x: 0, y: 0, w: 100 }), zIndex: z } };
      }),
    );
  }

  function addPage() {
    const nextIndex = Math.max(...pageIndices, 0) + 1;
    const custom = createCustomBlock("Новая страница");
    const rect = defaultRectForBlock("custom", 0, template, nextIndex);
    setBlocks([...blocks, { ...custom, rect }]);
    setPageIndex(nextIndex);
  }

  function addCustomOnPage() {
    const custom = createCustomBlock();
    const rect = defaultRectForBlock("custom", pageBlocks.length, template, pageIndex);
    setBlocks([...blocks, { ...custom, rect }]);
    setSelectedId(custom.id);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full min-h-[560px]">
      <div className="lg:col-span-3 grid gap-3 content-start max-h-[720px] overflow-y-auto">
        <div className="rounded-card border border-border bg-[#2a2f38] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
            <Layers size={14} />
            Слои (страница {pageIndex + 1})
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLayerDragEnd}>
            <SortableContext items={pageBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-1">
                {pageBlocks.map((b) => (
                  <SortableLayer
                    key={b.id}
                    block={b}
                    selected={selectedId === b.id}
                    onSelect={() => setSelectedId(b.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="flex flex-wrap gap-1 mt-2">
            <Button small variant="secondary" onClick={addCustomOnPage}>
              <Plus size={12} className="mr-1" />
              Блок
            </Button>
          </div>
        </div>
        <KpBlockInspector
          block={selected}
          template={template}
          onPatch={patchBlock}
          pageCount={countTemplatePages(template)}
        />
      </div>

      <div className="lg:col-span-9 min-h-[560px]">
        <KpDocumentFrame
          title="Холст A4 — режим Figma"
          subtitle="Перетаскивайте и меняйте размер блоков. Сетка и привязка — в настройках оформления."
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-1">
              {pageIndices.map((pi) => (
                <button
                  key={pi}
                  type="button"
                  onClick={() => setPageIndex(pi)}
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    pi === pageIndex ? "bg-primary text-white" : "bg-white/10 text-[#9ca3af]"
                  }`}
                >
                  {pi + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={addPage}
                className="rounded px-2 py-0.5 text-[11px] bg-white/10 text-[#9ca3af] hover:text-white"
              >
                + лист
              </button>
            </div>
          }
        >
          <div
            className={`kp-canvas-stage ${design.canvasShowGrid ? "kp-canvas-stage--grid" : ""}`}
            style={{
              width: KP_A4_WIDTH_PX,
              height: CANVAS_PAGE_HEIGHT,
              ["--kp-canvas-grid" as string]: `${grid}px`,
            }}
            onClick={() => setSelectedId(null)}
          >
            {pageBlocks.map((block) => {
              const r = block.rect || defaultRectForBlock(block.type, 0, template, pageIndex);
              const h = r.h || 80;
              const isSelected = selectedId === block.id;
              const label =
                block.type === "custom"
                  ? block.title || "Свой раздел"
                  : KP_PDF_BLOCK_META[block.type].label;

              return (
                <Rnd
                  key={block.id}
                  className={`kp-canvas-rnd ${isSelected ? "is-selected" : ""}`}
                  size={{ width: r.w, height: h }}
                  position={{ x: r.x, y: r.y }}
                  bounds="parent"
                  dragGrid={snap ? [grid, grid] : undefined}
                  resizeGrid={snap ? [grid, grid] : undefined}
                  onDragStop={(_e, d) => {
                    updateRect(block.id, {
                      x: snapCanvasValue(d.x, grid, snap),
                      y: snapCanvasValue(d.y, grid, snap),
                    });
                    setSelectedId(block.id);
                  }}
                  onResizeStop={(_e, _dir, ref, _delta, pos) => {
                    updateRect(block.id, {
                      x: snapCanvasValue(pos.x, grid, snap),
                      y: snapCanvasValue(pos.y, grid, snap),
                      w: snapCanvasValue(parseInt(ref.style.width, 10), grid, snap),
                      h: snapCanvasValue(parseInt(ref.style.height, 10), grid, snap),
                    });
                    setSelectedId(block.id);
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    setSelectedId(block.id);
                  }}
                  style={{ zIndex: r.zIndex ?? 1 }}
                >
                  {isSelected ? <span className="kp-canvas-rnd-label">{label}</span> : null}
                  <div style={blockInlineStyleCss(block, template)}>
                    <KpPreview
                      template={template}
                      input={input}
                      items={items}
                      dealId={dealId}
                      mode="document"
                      blocksOverride={[block]}
                      embedded
                    />
                  </div>
                </Rnd>
              );
            })}
          </div>
        </KpDocumentFrame>
      </div>
    </div>
  );
}
