import React from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import type { KpPdfBlock, KpPdfBlockType } from "./kpPdfBlocks";
import { KP_PDF_BLOCK_META, applyPdfBlockPreset } from "./kpPdfBlocks";

function SortableBlockRow({
  block,
  onToggle,
}: {
  block: KpPdfBlock;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const meta = KP_PDF_BLOCK_META[block.type];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-card border bg-white p-2 ${
        isDragging ? "border-primary shadow-md opacity-90" : "border-border"
      } ${block.enabled ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing p-1 text-text2 touch-none"
        aria-label="Перетащить блок"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{meta.label}</div>
        <div className="text-[11px] text-text2 truncate">{meta.hint}</div>
      </div>
      <label className="text-xs text-text2 flex items-center gap-1.5 shrink-0">
        <input
          type="checkbox"
          checked={block.enabled}
          onChange={(e) => onToggle(block.id, e.target.checked)}
        />
        в PDF
      </label>
    </div>
  );
}

export function KpPdfBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: KpPdfBlock[];
  onChange: (next: KpPdfBlock[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  function toggleBlock(id: string, enabled: boolean) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, enabled } : b)));
  }

  function applyPreset(preset: "standard" | "minimal" | "full") {
    onChange(applyPdfBlockPreset(preset));
  }

  const enabledCount = blocks.filter((b) => b.enabled).length;

  return (
    <div className="rounded-card border border-border bg-rowHover p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Блоки PDF</div>
          <div className="text-xs text-text2 mt-0.5">Перетащите для порядка · включите нужные блоки</div>
        </div>
        <Badge>{enabledCount} / {blocks.length} в PDF</Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button small variant="secondary" onClick={() => applyPreset("standard")}>
          Пресет: стандарт
        </Button>
        <Button small variant="secondary" onClick={() => applyPreset("minimal")}>
          Минимальный
        </Button>
        <Button small variant="secondary" onClick={() => applyPreset("full")}>
          Полный
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 grid gap-2">
            {blocks.map((b) => (
              <SortableBlockRow key={b.id} block={b} onToggle={toggleBlock} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-2 text-[11px] text-text2">
        Типы блоков: {(Object.keys(KP_PDF_BLOCK_META) as KpPdfBlockType[]).map((t) => KP_PDF_BLOCK_META[t].label).join(" · ")}
      </div>
    </div>
  );
}
