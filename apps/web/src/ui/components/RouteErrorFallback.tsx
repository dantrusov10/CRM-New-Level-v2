import { useRouteError } from "react-router-dom";
import { Button } from "./Button";
import { clearChunkReloadFlag, isChunkLoadError, reloadOnceForNewDeploy } from "../../lib/chunkReload";

export function RouteErrorFallback() {
  const err = useRouteError();
  const chunk = isChunkLoadError(err);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-lg font-semibold text-text">
        {chunk ? "Вышло обновление приложения" : "Не удалось открыть страницу"}
      </div>
      <p className="text-sm text-text2 max-w-md leading-relaxed">
        {chunk
          ? "Браузер пытался загрузить устаревную версию файлов после деплоя. Нажмите «Обновить» — страница перезагрузится с актуальной сборкой."
          : "Произошла ошибка при загрузке раздела. Попробуйте обновить страницу или вернитесь на дашборд."}
      </p>
      {!chunk && err instanceof Error && err.message ? (
        <pre className="text-[11px] text-text2 max-w-lg overflow-auto rounded-card border border-border bg-rowHover p-3 text-left">
          {err.message}
        </pre>
      ) : null}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          onClick={() => {
            if (chunk) {
              clearChunkReloadFlag();
              reloadOnceForNewDeploy() || window.location.reload();
            } else window.location.reload();
          }}
        >
          Обновить страницу
        </Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>
          На дашборд
        </Button>
      </div>
    </div>
  );
}
