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
import { pageBackgroundLayerStyle } from "./kpPageBackground";
import {
  KP_PDF_BLOCK_META,
  createCustomBlock,
  createImageBlock,
  duplicateBlock,
  ensurePdfBlocks,
} from "./kpPdfBlocks";
import { KpCanvasToolbar } from "./KpCanvasToolbar";
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type KpHistoryState,
} from "./kpCanvasHistory";
import {
  alignBlocksCenterX,
  alignBlocksLeft,
  equalizeBlockWidths,
  maxWidthOf,
} from "./kpCanvasAlign";
import { canvasInnerWidth, canvasMarginPx, CANVAS_PAGE_WIDTH } from "./kpCanvasLayout";
import { insertLibraryBlock, saveBlockToLibrary, ensureBlockLibrary } from "./kpBlockLibrary";
import type { KpInput, KpPdfBlock, KpTemplateConfig, SpecItem } from "./types";
import "./kpCanvasEditor.css";

let kpBlockClipboard: KpPdfBlock | null = null;

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
  sectionsPanel,
}: {
  template: KpTemplateConfig;
  onTemplateChange: (next: KpTemplateConfig) => void;
  input: KpInput;
  items: SpecItem[];
  dealId: string;
  /** Разделы документа — в одной линии со слоями и холстом */
  sectionsPanel?: React.ReactNode;
}) {
  const design = normalizePdfDesign(template);
  const grid = design.canvasGridPx;
  const snap = design.canvasSnap;

  const [history, setHistory] = React.useState<KpHistoryState | null>(null);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [guide, setGuide] = React.useState<{ x?: number; y?: number } | null>(null);

  React.useEffect(() => {
    const raw = ensurePdfBlocks(template);
    const b = ensureBlockRects(raw, template);
    setHistory(createHistory(b));
  }, [template.name, template.pdfDesign?.layoutMode]);

  const blocks = React.useMemo(() => {
    const base = history?.present ?? ensureBlockRects(ensurePdfBlocks(template), template);
    return ensureBlockRects(base, template);
  }, [history, template]);

  const pageBlocks = React.useMemo(() => blocksOnCanvasPage(blocks, pageIndex), [blocks, pageIndex]);
  const pageIndices = React.useMemo(() => canvasPageIndices(blocks), [blocks]);
  const selected = blocks.find((b) => b.id === selectedId) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commitBlocks(next: KpPdfBlock[]) {
    const normalized = ensureBlockRects(next, template);
    setHistory((h) => (h ? pushHistory(h, normalized) : createHistory(normalized)));
    onTemplateChange({ ...template, pdfBlocks: normalized });
  }

  function patchBlock(id: string, patch: Partial<KpPdfBlock>) {
    commitBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function updateRect(id: string, rect: Partial<NonNullable<KpPdfBlock["rect"]>>) {
    const b = blocks.find((x) => x.id === id);
    if (!b) return;
    patchBlock(id, { rect: { ...(b.rect || { x: 0, y: 0, w: 100, pageIndex }), ...rect } });
  }

  function moveGroup(blockId: string, dx: number, dy: number) {
    const src = blocks.find((b) => b.id === blockId);
    if (!src?.groupId) {
      updateRect(blockId, {
        x: (src?.rect?.x || 0) + dx,
        y: (src?.rect?.y || 0) + dy,
      });
      return;
    }
    const gid = src.groupId;
    commitBlocks(
      blocks.map((b) =>
        b.groupId === gid && b.rect
          ? { ...b, rect: { ...b.rect, x: b.rect.x + dx, y: b.rect.y + dy } }
          : b,
      ),
    );
  }

  function snapGuides(x: number, y: number, w: number, h: number) {
    const threshold = 6;
    const others = pageBlocks.filter((b) => b.id !== selectedId && b.rect);
    let nx = x;
    let ny = y;
    let gx: number | undefined;
    let gy: number | undefined;
    for (const o of others) {
      if (!o.rect) continue;
      const edges = [o.rect.x, o.rect.x + o.rect.w / 2, o.rect.x + o.rect.w];
      const myEdges = [nx, nx + w / 2, nx + w];
      for (let i = 0; i < edges.length; i++) {
        if (Math.abs(myEdges[i] - edges[i]) < threshold) {
          nx += edges[i] - myEdges[i];
          gx = edges[i];
        }
      }
      const ye = [o.rect.y, o.rect.y + (o.rect.h || 0) / 2, o.rect.y + (o.rect.h || 0)];
      const my = [ny, ny + h / 2, ny + h];
      for (let i = 0; i < ye.length; i++) {
        if (Math.abs(my[i] - ye[i]) < threshold) {
          ny += ye[i] - my[i];
          gy = ye[i];
        }
      }
    }
    setGuide({ x: gx, y: gy });
    return { x: nx, y: ny };
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
    commitBlocks(
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
    commitBlocks([...blocks, { ...custom, rect }]);
    setPageIndex(nextIndex);
  }

  function addCustomOnPage() {
    const custom = createCustomBlock();
    const rect = defaultRectForBlock("custom", pageBlocks.length, template, pageIndex);
    commitBlocks([...blocks, { ...custom, rect }]);
    setSelectedId(custom.id);
  }

  const selectedIds = selectedId ? [selectedId] : [];
  const margin = canvasMarginPx(template);

  return (
    <div className="grid gap-2 w-full">
      <KpCanvasToolbar
        canUndo={!!history?.past.length}
        canRedo={!!history?.future.length}
        canPaste={!!kpBlockClipboard}
        onUndo={() => {
          if (!history) return;
          const h = undoHistory(history);
          if (h) {
            setHistory(h);
            onTemplateChange({ ...template, pdfBlocks: h.present });
          }
        }}
        onRedo={() => {
          if (!history) return;
          const h = redoHistory(history);
          if (h) {
            setHistory(h);
            onTemplateChange({ ...template, pdfBlocks: h.present });
          }
        }}
        onCopy={() => {
          if (selected) kpBlockClipboard = duplicateBlock(selected);
        }}
        onPaste={() => {
          if (!kpBlockClipboard) return;
          const pasted = duplicateBlock(kpBlockClipboard);
          pasted.rect = defaultRectForBlock(pasted.type, pageBlocks.length, template, pageIndex);
          commitBlocks([...blocks, pasted]);
          setSelectedId(pasted.id);
        }}
        onDuplicate={() => {
          if (!selected) return;
          const d = duplicateBlock(selected);
          d.rect = {
            ...(selected.rect || defaultRectForBlock(selected.type, 0, template, pageIndex)),
            x: (selected.rect?.x || 0) + 20,
            y: (selected.rect?.y || 0) + 20,
          };
          commitBlocks([...blocks, d]);
          setSelectedId(d.id);
        }}
        onAlignLeft={() => {
          if (!selectedIds.length) return;
          commitBlocks(alignBlocksLeft(blocks, selectedIds, margin));
        }}
        onAlignCenter={() => {
          if (!selectedIds.length) return;
          commitBlocks(alignBlocksCenterX(blocks, selectedIds, CANVAS_PAGE_WIDTH));
        }}
        onEqualWidth={() => {
          if (!selectedIds.length) return;
          const w = maxWidthOf(blocks, selectedIds) || canvasInnerWidth(template);
          commitBlocks(equalizeBlockWidths(blocks, selectedIds, w));
        }}
        onGroup={() => {
          if (!selected) return;
          const gid = `grp_${Date.now().toString(36)}`;
          patchBlock(selected.id, { groupId: gid });
        }}
        onUngroup={() => {
          if (!selected?.groupId) return;
          const gid = selected.groupId;
          commitBlocks(blocks.map((b) => (b.groupId === gid ? { ...b, groupId: undefined } : b)));
        }}
        onAddImage={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/png,image/jpeg,image/webp";
          input.onchange = () => {
            const f = input.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
              const url = String(reader.result || "");
              const img = createImageBlock(url, f.name);
              img.rect = defaultRectForBlock("image", pageBlocks.length, template, pageIndex);
              commitBlocks([...blocks, img]);
              setSelectedId(img.id);
            };
            reader.readAsDataURL(f);
          };
          input.click();
        }}
      />

    <div className="grid grid-cols-12 gap-2 w-full items-start min-h-[560px]">
      <div className="col-span-12 xl:col-span-2 grid gap-2 content-start max-h-[min(78vh,820px)] overflow-y-auto crm-scrollbar">
        <div className="rounded-card border border-border bg-[#2a2f38] p-2">
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
        {ensureBlockLibrary(template).length ? (
          <div className="rounded-card border border-border bg-[#2a2f38] p-2">
            <div className="text-[10px] font-semibold text-white mb-1">Библиотека</div>
            {ensureBlockLibrary(template).map((e) => (
              <button
                key={e.id}
                type="button"
                className="block w-full text-left text-[10px] text-[#9ca3af] hover:text-white py-1 truncate"
                onClick={() => commitBlocks(insertLibraryBlock(template, e.id, blocks))}
              >
                + {e.name}
              </button>
            ))}
          </div>
        ) : null}
        {selected ? (
          <Button
            small
            variant="secondary"
            onClick={() => {
              const name = window.prompt("Имя в библиотеке", selected.title || "Раздел");
              if (!name) return;
              onTemplateChange(saveBlockToLibrary(template, selected, name));
            }}
          >
            В библиотеку
          </Button>
        ) : null}
      </div>

      {sectionsPanel ? (
        <div className="col-span-12 xl:col-span-3 max-h-[min(78vh,820px)] overflow-y-auto crm-scrollbar">
          {sectionsPanel}
        </div>
      ) : null}

      <div
        className={`col-span-12 min-h-[520px] ${
          sectionsPanel ? "xl:col-span-4" : "xl:col-span-8"
        }`}
      >
        <KpDocumentFrame
          title="Холст A4"
          subtitle="Перетаскивайте блоки. Сетка — в «Оформление»."
          canvasAlign="start"
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
            onClick={() => {
              setSelectedId(null);
              setGuide(null);
            }}
          >
            <div aria-hidden style={pageBackgroundLayerStyle(template)} />
            {guide?.x != null ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary z-[99]"
                style={{ left: guide.x }}
              />
            ) : null}
            {guide?.y != null ? (
              <div
                className="pointer-events-none absolute left-0 right-0 h-px bg-primary z-[99]"
                style={{ top: guide.y }}
              />
            ) : null}
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
                    setGuide(null);
                    const h = r.h || 80;
                    let x = snapCanvasValue(d.x, grid, snap);
                    let y = snapCanvasValue(d.y, grid, snap);
                    const snapped = snapGuides(x, y, r.w, h);
                    x = snapCanvasValue(snapped.x, grid, snap);
                    y = snapCanvasValue(snapped.y, grid, snap);
                    if (block.groupId) {
                      const dx = x - (r.x || 0);
                      const dy = y - (r.y || 0);
                      moveGroup(block.id, dx, dy);
                    } else {
                      updateRect(block.id, { x, y });
                    }
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
                  style={{
                    zIndex: r.zIndex ?? 1,
                    transform: r.rotateDeg ? `rotate(${r.rotateDeg}deg)` : undefined,
                    transformOrigin: "center center",
                  }}
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

      <div className="col-span-12 xl:col-span-3 max-h-[min(78vh,820px)] overflow-y-auto crm-scrollbar">
        <KpBlockInspector
          block={selected}
          template={template}
          onPatch={patchBlock}
          pageCount={countTemplatePages(template)}
        />
      </div>
    </div>
    </div>
  );
}
