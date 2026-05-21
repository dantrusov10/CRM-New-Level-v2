import React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignHorizontalSpaceAround,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Redo2,
  Undo2,
  ImagePlus,
  Group,
  Ungroup,
} from "lucide-react";
import { Button } from "../../components/Button";

export function KpCanvasToolbar({
  canUndo,
  canRedo,
  canPaste,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onAlignLeft,
  onAlignCenter,
  onEqualWidth,
  onGroup,
  onUngroup,
  onAddImage,
}: {
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onEqualWidth: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onAddImage: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-card border border-border bg-[#2a2f38] p-2">
      <Button small variant="secondary" disabled={!canUndo} onClick={onUndo} title="Отменить">
        <Undo2 size={14} />
      </Button>
      <Button small variant="secondary" disabled={!canRedo} onClick={onRedo} title="Повторить">
        <Redo2 size={14} />
      </Button>
      <span className="w-px h-6 bg-border self-center mx-0.5" />
      <Button small variant="secondary" onClick={onCopy} title="Копировать блок">
        <Copy size={14} />
      </Button>
      <Button small variant="secondary" disabled={!canPaste} onClick={onPaste} title="Вставить">
        <ClipboardPaste size={14} />
      </Button>
      <Button small variant="secondary" onClick={onDuplicate} title="Дублировать">
        <CopyPlus size={14} />
      </Button>
      <span className="w-px h-6 bg-border self-center mx-0.5" />
      <Button small variant="secondary" onClick={onAlignLeft} title="По левому краю">
        <AlignLeft size={14} />
      </Button>
      <Button small variant="secondary" onClick={onAlignCenter} title="По центру листа">
        <AlignCenter size={14} />
      </Button>
      <Button small variant="secondary" onClick={onEqualWidth} title="Одинаковая ширина">
        <AlignHorizontalSpaceAround size={14} />
      </Button>
      <span className="w-px h-6 bg-border self-center mx-0.5" />
      <Button small variant="secondary" onClick={onGroup} title="Сгруппировать выбранные">
        <Group size={14} />
      </Button>
      <Button small variant="secondary" onClick={onUngroup} title="Разгруппировать">
        <Ungroup size={14} />
      </Button>
      <Button small variant="secondary" onClick={onAddImage} title="Добавить картинку">
        <ImagePlus size={14} className="mr-1" />
        Картинка
      </Button>
    </div>
  );
}
