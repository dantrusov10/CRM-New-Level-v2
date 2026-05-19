import React from "react";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import type { FunnelStage, UserSummary } from "../../../lib/types";

export function DealsBulkActionsModal({
  open,
  onClose,
  selectedCount,
  stages,
  users,
  onDelete,
  onStage,
  onOwner,
}: {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  stages: FunnelStage[];
  users: UserSummary[];
  onDelete: () => void | Promise<void>;
  onStage: (stageId: string) => void | Promise<void>;
  onOwner: (ownerId: string) => void | Promise<void>;
}) {
  const [stageTo, setStageTo] = React.useState("");
  const [ownerTo, setOwnerTo] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setStageTo("");
      setOwnerTo("");
    }
  }, [open]);

  return (
    <Modal open={open} title={`Массовые действия (${selectedCount})`} onClose={onClose} widthClass="max-w-md">
      <div className="grid gap-3">
        <div>
          <div className="text-xs text-text2 mb-1">Новый этап</div>
          <select className="ui-input h-9 w-full" value={stageTo} onChange={(e) => setStageTo(e.target.value)}>
            <option value="">Не менять</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.stage_name ?? "Этап"}</option>
            ))}
          </select>
          <Button
            className="mt-2 w-full"
            variant="secondary"
            disabled={!stageTo}
            onClick={async () => { await onStage(stageTo); onClose(); }}
          >
            Применить этап
          </Button>
        </div>
        <div>
          <div className="text-xs text-text2 mb-1">Новый ответственный</div>
          <select className="ui-input h-9 w-full" value={ownerTo} onChange={(e) => setOwnerTo(e.target.value)}>
            <option value="">Не менять</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name ?? u.name ?? u.email}</option>
            ))}
          </select>
          <Button
            className="mt-2 w-full"
            variant="secondary"
            disabled={!ownerTo}
            onClick={async () => { await onOwner(ownerTo); onClose(); }}
          >
            Применить ответственного
          </Button>
        </div>
        <Button variant="danger" onClick={async () => { await onDelete(); onClose(); }}>Удалить выбранные</Button>
      </div>
    </Modal>
  );
}
