import { CalendarPlus, FileText, ListTodo, Sparkles, Target } from "lucide-react";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";

export function DealCommandCenter({
  title,
  companyName,
  stageName,
  score,
  scoreLabel,
  aiOneLiner,
  nextStep,
  aiLoading,
  onRunAi,
  onCreateTaskFromStep,
  onOpenKp,
  onOpenAiTab,
  onAddNote,
}: {
  title: string;
  companyName?: string;
  stageName?: string;
  score?: number | null;
  scoreLabel?: string;
  aiOneLiner?: string;
  nextStep?: string;
  aiLoading?: boolean;
  onRunAi: () => void;
  onCreateTaskFromStep: () => void;
  onOpenKp: () => void;
  onOpenAiTab: () => void;
  onAddNote: () => void;
}) {
  const step = (nextStep || "").trim();

  return (
    <div className="rounded-card border border-[rgba(51,215,255,0.35)] bg-[linear-gradient(135deg,rgba(45,123,255,0.18),rgba(7,26,51,0.92))] p-4 shadow-[0_0_24px_rgba(51,215,255,0.12)]">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-base sm:text-lg font-bold truncate">{title || "Сделка"}</h1>
            {companyName ? <Badge>{companyName}</Badge> : null}
            {stageName ? <Badge>{stageName}</Badge> : null}
          </div>
          {aiOneLiner ? (
            <p className="text-sm text-text2 leading-relaxed line-clamp-2">
              <Sparkles size={14} className="inline mr-1 text-primary align-text-bottom" />
              {aiOneLiner}
            </p>
          ) : (
            <p className="text-sm text-text2">Запустите AI-анализ — появится краткий вывод и следующий шаг.</p>
          )}
          {step ? (
            <div className="mt-3 rounded-lg border border-[rgba(51,215,255,0.28)] bg-[rgba(255,255,255,0.05)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-text2 font-semibold mb-1 flex items-center gap-1">
                <Target size={12} /> Следующий шаг
              </div>
              <div className="text-sm font-medium leading-relaxed">{step}</div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2">
          <div className="rounded-lg border border-[rgba(51,215,255,0.3)] bg-[rgba(51,215,255,0.1)] px-3 py-2 text-center min-w-[100px]">
            <div className="text-[10px] text-text2 uppercase">Вероятность</div>
            <div className="text-2xl font-extrabold tabular-nums">{typeof score === "number" ? `${score}%` : "—"}</div>
            {scoreLabel ? <div className="text-[10px] text-text2 mt-0.5">{scoreLabel}</div> : null}
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            <Button small onClick={onRunAi} disabled={aiLoading} className="neon-accent">
              {aiLoading ? "AI…" : "AI-анализ"}
            </Button>
            {step ? (
              <Button small variant="secondary" onClick={onCreateTaskFromStep} title="Создать задачу из шага">
                <ListTodo size={14} />
                <span className="hidden sm:inline">Задача</span>
              </Button>
            ) : null}
            <Button small variant="secondary" onClick={onOpenKp} title="Коммерческое предложение">
              <FileText size={14} />
              <span className="hidden sm:inline">КП</span>
            </Button>
            <Button small variant="secondary" onClick={onAddNote} title="Заметка в ленте">
              <CalendarPlus size={14} />
              <span className="hidden sm:inline">Заметка</span>
            </Button>
            <Button small variant="ghost" onClick={onOpenAiTab}>
              Подробнее
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
