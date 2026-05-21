import React from "react";
import { Download, FileText, Upload } from "lucide-react";
import { AlertDialog, PromptDialog } from "../../components/ConfirmDialog";
import { Button } from "../../components/Button";
import type { KpTemplateConfig } from "./types";
import { ensurePdfBlocks } from "./kpPdfBlocks";
import { docxFileToHtml, htmlFileToHtml, mergeImportedHtmlIntoTemplate } from "./kpDocxImport";
import { importDocxAsFullTemplate } from "./kpDocxTemplateImport";

export function KpTemplateImportExport({
  draft,
  onImport,
}: {
  draft: KpTemplateConfig;
  onImport: (json: KpTemplateConfig) => void;
}) {
  const jsonRef = React.useRef<HTMLInputElement | null>(null);
  const docxRef = React.useRef<HTMLInputElement | null>(null);
  const docxFullRef = React.useRef<HTMLInputElement | null>(null);
  const htmlRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [alert, setAlert] = React.useState<{ title: string; message: string } | null>(null);
  const [prompt, setPrompt] = React.useState<{
    title: string;
    label: string;
    defaultValue: string;
    onOk: (title: string) => void;
  } | null>(null);

  function exportJson() {
    const payload = {
      ...draft,
      pdfBlocks: ensurePdfBlocks(draft),
      exportedAt: new Date().toISOString(),
      exportVersion: 3,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(draft.name || "kp-template").replace(/[^\wа-яА-ЯёЁ\-]+/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}")) as KpTemplateConfig;
        if (!parsed || typeof parsed !== "object") throw new Error("Пустой файл");
        onImport(parsed);
      } catch {
        setAlert({
          title: "Ошибка импорта",
          message: "Не удалось прочитать шаблон. Нужен .json, экспортированный из этой CRM.",
        });
      }
      e.target.value = "";
    };
    reader.readAsText(f, "utf-8");
  }

  async function onDocxFullFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      onImport(await importDocxAsFullTemplate(draft, f));
    } catch (err) {
      setAlert({
        title: "Бланк Word",
        message: err instanceof Error ? err.message : "Не удалось импортировать .docx как шаблон",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onDocxFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const html = await docxFileToHtml(f);
      setPrompt({
        title: "Раздел из Word",
        label: "Заголовок нового раздела",
        defaultValue: f.name.replace(/\.docx$/i, ""),
        onOk: (title) => onImport(mergeImportedHtmlIntoTemplate(draft, html, title || "Из Word")),
      });
    } catch (err) {
      setAlert({
        title: "Word",
        message: err instanceof Error ? err.message : "Не удалось прочитать .docx",
      });
    } finally {
      setBusy(false);
    }
  }

  function onHtmlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const html = htmlFileToHtml(String(reader.result || ""));
        setPrompt({
          title: "Раздел из HTML",
          label: "Заголовок раздела",
          defaultValue: f.name.replace(/\.html?$/i, ""),
          onOk: (title) => onImport(mergeImportedHtmlIntoTemplate(draft, html, title || "Из HTML")),
        });
      } catch {
        setAlert({ title: "HTML", message: "Не удалось прочитать HTML-файл" });
      }
      e.target.value = "";
    };
    reader.readAsText(f, "utf-8");
  }

  return (
    <>
      <div className="rounded-card border border-border bg-rowHover p-3 grid gap-3">
        <div>
          <div className="text-sm font-semibold">Импорт и экспорт шаблона</div>
          <p className="text-[11px] text-text2 mt-0.5 max-w-lg leading-relaxed">
            JSON — полный шаблон. Word — раздел или целый бланк. HTML — новый раздел. PDF как шаблон не поддерживается.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button small variant="secondary" onClick={exportJson}>
            <Download size={14} className="mr-1" />
            Скачать .json
          </Button>
          <Button small variant="secondary" onClick={() => jsonRef.current?.click()} disabled={busy}>
            <Upload size={14} className="mr-1" />
            Загрузить .json
          </Button>
          <Button small variant="secondary" onClick={() => docxRef.current?.click()} disabled={busy}>
            <FileText size={14} className="mr-1" />
            {busy ? "Word…" : ".docx → раздел"}
          </Button>
          <Button small variant="secondary" onClick={() => docxFullRef.current?.click()} disabled={busy}>
            <FileText size={14} className="mr-1" />
            {busy ? "Word…" : ".docx → бланк"}
          </Button>
          <Button small variant="secondary" onClick={() => htmlRef.current?.click()} disabled={busy}>
            <FileText size={14} className="mr-1" />
            Загрузить .html
          </Button>
        </div>
        <input ref={jsonRef} type="file" accept="application/json,.json" className="hidden" onChange={onJsonFile} />
        <input
          ref={docxRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => void onDocxFile(e)}
        />
        <input
          ref={docxFullRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => void onDocxFullFile(e)}
        />
        <input ref={htmlRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={onHtmlFile} />
      </div>

      <AlertDialog
        open={!!alert}
        title={alert?.title || ""}
        message={alert?.message || ""}
        onClose={() => setAlert(null)}
      />

      <PromptDialog
        open={!!prompt}
        title={prompt?.title || ""}
        label={prompt?.label || ""}
        defaultValue={prompt?.defaultValue || ""}
        onConfirm={(v) => {
          prompt?.onOk(v);
          setPrompt(null);
        }}
        onCancel={() => setPrompt(null)}
      />
    </>
  );
}
