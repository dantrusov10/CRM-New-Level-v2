import React from "react";
import dayjs from "dayjs";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { DateTimePicker } from "../../components/DateTimePicker";
import { ACTION_OUTCOMES, OUTCOME_LABELS, type ActionOutcome } from "./dealActionOutcome";

export type CreateTaskModalProps = {
  open: boolean;
  actionText: string;
  onClose: () => void;
  onConfirm: (params: { dueAt: string; title: string }) => Promise<void>;
  saving?: boolean;
};

export function CreateTaskFromActionModal({ open, actionText, onClose, onConfirm, saving }: CreateTaskModalProps) {
  const defaultDue = React.useMemo(
    () => dayjs().add(2, "day").hour(12).minute(0).second(0).millisecond(0).format("YYYY-MM-DDTHH:mm"),
    [open],
  );
  const [dueAt, setDueAt] = React.useState(defaultDue);
  const [title, setTitle] = React.useState(actionText);

  React.useEffect(() => {
    if (!open) return;
    setTitle(actionText);
    setDueAt(dayjs().add(2, "day").hour(12).minute(0).second(0).millisecond(0).format("YYYY-MM-DDTHH:mm"));
  }, [open, actionText]);

  return (
    <Modal open={open} title="Создать задачу" onClose={onClose}>
      <div className="grid gap-3">
        <div>
          <div className="text-xs text-text2 mb-1">Текст задачи</div>
          <textarea className="ui-input min-h-[72px] w-full text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-text2 mb-1">Срок выполнения</div>
          <DateTimePicker value={dueAt} onChange={setDueAt} className="w-full" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            disabled={saving || !title.trim() || !dueAt}
            onClick={() => void onConfirm({ dueAt, title: title.trim() })}
          >
            {saving ? "Сохранение..." : "Создать задачу"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type RespondMode = "menu" | "dismiss" | "comment" | "complete";

export type RespondModalProps = {
  open: boolean;
  actionText: string;
  onClose: () => void;
  onDismiss: (params: { outcome: ActionOutcome; reason: string }) => Promise<void>;
  onComment: (params: { comment: string }) => Promise<void>;
  onComplete: (params: { outcome: ActionOutcome; comment: string }) => Promise<void>;
  saving?: boolean;
};

function OutcomePicker({
  value,
  onChange,
  required,
}: {
  value: ActionOutcome | "";
  onChange: (v: ActionOutcome) => void;
  required?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-text2 mb-1">
        Результат{required ? " *" : ""}
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTION_OUTCOMES.map((o) => (
          <button
            key={o}
            type="button"
            className={`ui-btn h-9 px-3 text-sm ${value === o ? "ui-btn-primary" : "ui-btn-secondary"}`}
            onClick={() => onChange(o)}
          >
            {OUTCOME_LABELS[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RespondToActionModal({
  open,
  actionText,
  onClose,
  onDismiss,
  onComment,
  onComplete,
  saving,
}: RespondModalProps) {
  const [mode, setMode] = React.useState<RespondMode>("menu");
  const [outcome, setOutcome] = React.useState<ActionOutcome | "">("");
  const [reason, setReason] = React.useState("");
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setMode("menu");
    setOutcome("");
    setReason("");
    setComment("");
  }, [open]);

  const title =
    mode === "menu"
      ? "Ответить на действие"
      : mode === "dismiss"
        ? "Удалить / отклонить действие"
        : mode === "comment"
          ? "Комментарий к действию"
          : "Отметить выполненным";

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (saving) return;
        setMode("menu");
        onClose();
      }}
    >
      <div className="grid gap-3">
        <div className="rounded-md border border-border bg-rowHover/60 p-2.5 text-sm leading-relaxed">{actionText}</div>

        {mode === "menu" ? (
          <div className="grid gap-2">
            <Button variant="secondary" onClick={() => setMode("dismiss")}>
              Удалить действие
            </Button>
            <Button variant="secondary" onClick={() => setMode("comment")}>
              Написать комментарий
            </Button>
            <Button onClick={() => setMode("complete")}>Выполнено</Button>
          </div>
        ) : null}

        {mode === "dismiss" ? (
          <>
            <OutcomePicker value={outcome} onChange={setOutcome} required />
            <div>
              <div className="text-xs text-text2 mb-1">Причина удаления *</div>
              <textarea
                className="ui-input min-h-[80px] w-full text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Почему действие снято с плана..."
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => setMode("menu")} disabled={saving}>
                Назад
              </Button>
              <Button
                disabled={saving || !outcome || !reason.trim()}
                onClick={() => {
                  if (!outcome) return;
                  void onDismiss({ outcome, reason: reason.trim() });
                }}
              >
                {saving ? "..." : "Зафиксировать"}
              </Button>
            </div>
          </>
        ) : null}

        {mode === "comment" ? (
          <>
            <div>
              <div className="text-xs text-text2 mb-1">Комментарий менеджера *</div>
              <textarea
                className="ui-input min-h-[80px] w-full text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => setMode("menu")} disabled={saving}>
                Назад
              </Button>
              <Button
                disabled={saving || !comment.trim()}
                onClick={() => void onComment({ comment: comment.trim() })}
              >
                {saving ? "..." : "Сохранить"}
              </Button>
            </div>
          </>
        ) : null}

        {mode === "complete" ? (
          <>
            <OutcomePicker value={outcome} onChange={setOutcome} required />
            <div>
              <div className="text-xs text-text2 mb-1">Комментарий по выполнению *</div>
              <textarea
                className="ui-input min-h-[80px] w-full text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Что сделано, результат..."
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => setMode("menu")} disabled={saving}>
                Назад
              </Button>
              <Button
                disabled={saving || !outcome || !comment.trim()}
                onClick={() => {
                  if (!outcome) return;
                  void onComplete({ outcome, comment: comment.trim() });
                }}
              >
                {saving ? "..." : "Выполнено"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
