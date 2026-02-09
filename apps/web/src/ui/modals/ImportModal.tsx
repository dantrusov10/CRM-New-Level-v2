import React from "react";
import clsx from "clsx";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { parseTabularFile, downloadCsv, downloadXlsx, guessMapping } from "../../lib/importExport";
import { pb } from "../../lib/pb";
import { useAuth } from "../../app/AuthProvider";

type EntityType = "deal" | "company";

type ImportErrorRow = {
  row: number;
  error: string;
  data: Record<string, any>;
};

function FieldRow({
  label,
  required,
  value,
  onChange,
  headers,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  headers: string[];
}) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-3 items-center">
      <div className="text-sm">
        {label} {required ? <span className="text-danger">*</span> : null}
      </div>
      <select
        className="h-10 rounded-card border border-border bg-white px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— не импортировать —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

function DropZone({
  onFile,
  accept,
  hint,
}: {
  onFile: (f: File) => void;
  accept: string;
  hint?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = React.useState(false);

  return (
    <div>
      <div
        className={clsx(
          "rounded-card border border-dashed p-4 text-sm",
          drag ? "border-primary bg-primarySoft" : "border-border bg-white"
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Перетащите файл сюда</div>
            <div className="text-text2 text-xs mt-1">или выберите файл кнопкой ниже. Поддержка: CSV / XLSX.</div>
            {hint ? <div className="text-text2 text-xs mt-1">{hint}</div> : null}
          </div>
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            Выбрать файл
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              // allow selecting same file again
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();

  const [entity, setEntity] = React.useState<EntityType>("deal");
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, any>[]>([]);
  const [rowNums, setRowNums] = React.useState<number[]>([]);

  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [createCompanies, setCreateCompanies] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<string>("");
  const [errors, setErrors] = React.useState<ImportErrorRow[]>([]);
  const [result, setResult] = React.useState<{ ok: number; total: number } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    // reset on open
    setStep(1);
    setEntity("deal");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setRowNums([]);
    setMapping({});
    setCreateCompanies(true);
    setRunning(false);
    setProgress("");
    setErrors([]);
    setResult(null);
  }, [open]);

  const aliasesDeal = React.useMemo(
    () => ({
      id: ["id", "ID"],
      title: ["title", "Название сделки", "Сделка", "name"],
      company_name: ["company", "Компания", "company_name", "Компания (название)", "Название компании"],
      company_inn: ["inn", "ИНН", "company_inn"],
      stage: ["stage", "Этап", "stage_name"],
      budget: ["budget", "Бюджет"],
      turnover: ["turnover", "Оборот"],
      margin_percent: ["margin_percent", "Маржа", "Маржа %", "Маржа, %"],
      discount_percent: ["discount_percent", "Скидка", "Скидка %", "Скидка, %"],
      sales_channel: ["sales_channel", "Канал продаж"],
      partner: ["partner", "Партнёр"],
      distributor: ["distributor", "Дистрибьютор"],
      purchase_format: ["purchase_format", "Формат закупки"],
      attraction_channel: ["attraction_channel", "Канал привлечения"],
      attraction_date: ["attraction_date", "Дата привлечения"],
      expected_payment_date: ["expected_payment_date", "Ожидаемая оплата"],
      payment_received_date: ["payment_received_date", "Фактическая оплата"],
    }),
    []
  );

  const aliasesCompany = React.useMemo(
    () => ({
      id: ["id", "ID"],
      name: ["name", "Компания", "Название компании"],
      inn: ["inn", "ИНН"],
      sales_channel: ["sales_channel", "sales_channel_id", "Канал продаж", "Канал"],
      website: ["website", "site", "Сайт"],
      city: ["city", "Город"],
      phone: ["phone", "Телефон"],
      email: ["email", "Email", "E-mail"],
      legal_entity: ["legal_entity", "Юр.лицо", "Юридическое лицо"],
      address: ["address", "Адрес"],
    }),
    []
  );

  async function onPickFile(f: File) {
    setFile(f);
    setProgress("Читаем файл...");
    setErrors([]);
    setResult(null);
    const parsed = await parseTabularFile(f);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setRowNums(parsed.rowNumbers);

    // prefill mapping
    const auto = guessMapping(parsed.headers, entity === "deal" ? aliasesDeal : aliasesCompany);
    setMapping(auto);
    setStep(3);
    setProgress("");
  }

  async function downloadTemplate() {
    if (entity === "deal") {
      // Dynamic template: all active deal fields (visible OR required) + 5 notes columns
      const filter = `entity_type="deal" && (visible=true || required=true)`;
      const fields = (await pb
        .collection("settings_fields")
        .getFullList({ filter, sort: "order,sort_order" })
        .catch(() => [])) as any[];

      const seen = new Set<string>();
      const headers: string[] = [];
      for (const f of fields) {
        const h0 = String(f?.label ?? "").trim();
        if (!h0) continue;
        let h = h0;
        let i = 2;
        while (seen.has(h)) {
          h = `${h0} (${i})`;
          i += 1;
        }
        seen.add(h);
        headers.push(h);
      }

      // Always add 5 notes columns for timeline comments
      for (let i = 1; i <= 5; i++) headers.push(`Примечание ${i}`);

      const row: Record<string, any> = {};
      for (const h of headers) row[h] = "";

      downloadXlsx([row], "deals", "template_deals.xlsx");
      return;
    }

    // companies template stays simple (MVP)
    const template = [
      {
        "Название компании": "",
        "ИНН": "",
        "Город": "",
        "Сайт": "",
        "Телефон": "",
        "Email": "",
      },
    ];
    downloadXlsx(template, "companies", "template_companies.xlsx");
  }

  async function runImport() {
    if (!rows.length) return;
    setRunning(true);
    setErrors([]);
    setResult(null);

    let ok = 0;
    const errs: ImportErrorRow[] = [];

    // caches
    const stageCache = new Map<string, string>(); // stage_name -> id
    const companyByInn = new Map<string, string>();
    const companyByName = new Map<string, string>();
    const salesChannelByKey = new Map<string, string>();


    // Active deal fields (for dynamic import + template parity)
    const dealFields = entity === "deal"
      ? (((await pb
          .collection("settings_fields")
          .getFullList({ filter: `entity_type="deal" && (visible=true || required=true)`, sort: "order,sort_order" })
          .catch(() => [])) as any[]) ?? [])
      : [];

    const dealFieldByLabel = new Map<string, any>();
    for (const f of dealFields) {
      const lbl = String(f?.label ?? "").trim();
      if (!lbl) continue;
      // if duplicates exist, keep the first one (admin should avoid duplicates)
      if (!dealFieldByLabel.has(lbl)) dealFieldByLabel.set(lbl, f);
    }

    const get = (r: Record<string, any>, key: string) => {
      const col = mapping[key];
      if (!col) return "";
      return r[col];
    };

    async function resolveStageId(stageName: string): Promise<string | ""> {
      const s = (stageName || "").toString().trim();
      if (!s) return "";
      if (stageCache.has(s)) return stageCache.get(s)!;
      const found = await pb
        .collection("settings_funnel_stages")
        .getList(1, 1, { filter: `stage_name="${s.replace(/"/g, "\\\"")}"` })
        .then((x) => x.items?.[0])
        .catch(() => null);
      if (!found) return "";
      stageCache.set(s, (found as any).id);
      return (found as any).id;
    }

    async function resolveSalesChannelId(raw: string): Promise<string | null> {
      const s0 = String(raw || "").trim();
      if (!s0) return null;
      const code = s0.toLowerCase().replace(/\s+/g, "_");
      if (salesChannelByKey.has(code)) return salesChannelByKey.get(code)!;
      // try by code
      const foundByCode = await pb
        .collection("sales_channels")
        .getList(1, 1, { filter: `code="${code.replace(/"/g, "\\\"")}"` })
        .then((x) => x.items?.[0])
        .catch(() => null);
      if (foundByCode) {
        salesChannelByKey.set(code, (foundByCode as any).id);
        return (foundByCode as any).id;
      }
      // try by name
      const foundByName = await pb
        .collection("sales_channels")
        .getList(1, 1, { filter: `name="${s0.replace(/"/g, "\\\"")}"` })
        .then((x) => x.items?.[0])
        .catch(() => null);
      if (foundByName) {
        salesChannelByKey.set(code, (foundByName as any).id);
        return (foundByName as any).id;
      }

      // auto-create channel (admin-like behavior). This keeps import smooth.
      const created = await pb
        .collection("sales_channels")
        .create({ name: s0, code, is_active: true })
        .catch(() => null);
      if (created) {
        salesChannelByKey.set(code, (created as any).id);
        return (created as any).id;
      }
      return null;
    }

    async function resolveCompanyId(name: string, inn: string): Promise<string> {
      const n = (name || "").toString().trim();
      const i = (inn || "").toString().trim();
      if (!n && !i) throw new Error("Не указана компания (название или ИНН)");

      if (i) {
        if (companyByInn.has(i)) return companyByInn.get(i)!;
        const found = await pb
          .collection("companies")
          .getList(1, 1, { filter: `inn="${i.replace(/"/g, "\\\"")}"` })
          .then((x) => x.items?.[0])
          .catch(() => null);
        if (found) {
          companyByInn.set(i, (found as any).id);
          return (found as any).id;
        }
      }

      if (n) {
        if (companyByName.has(n)) return companyByName.get(n)!;
        const found = await pb
          .collection("companies")
          .getList(1, 1, { filter: `name="${n.replace(/"/g, "\\\"")}"` })
          .then((x) => x.items?.[0])
          .catch(() => null);
        if (found) {
          companyByName.set(n, (found as any).id);
          return (found as any).id;
        }
      }

      if (!createCompanies) throw new Error("Компания не найдена и создание отключено");

      const created = await pb.collection("companies").create({
        name: n || i,
        inn: i || undefined,
        responsible_id: user?.id || undefined,
      });
      if (i) companyByInn.set(i, created.id);
      if (n) companyByName.set(n, created.id);
      return created.id;
    }

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const rowNumber = rowNums[idx] ?? idx + 2;
      try {
        if (entity === "company") {
          const id = String(get(r, "id") || "").trim();
          const name = String(get(r, "name") || "").trim();
          if (!name) throw new Error("Название компании обязательно");
          const salesChannelRaw = String(get(r, "sales_channel") || "").trim();
          const salesChannelId = await resolveSalesChannelId(salesChannelRaw);
          const payload: any = {
            name,
            inn: String(get(r, "inn") || "").trim() || undefined,
            sales_channel_id: salesChannelId || undefined,
            website: String(get(r, "website") || "").trim() || undefined,
            city: String(get(r, "city") || "").trim() || undefined,
            phone: String(get(r, "phone") || "").trim() || undefined,
            email: String(get(r, "email") || "").trim() || undefined,
            legal_entity: String(get(r, "legal_entity") || "").trim() || undefined,
            address: String(get(r, "address") || "").trim() || undefined,
            responsible_id: user?.id || undefined,
          };
          if (id) await pb.collection("companies").update(id, payload);
          else await pb.collection("companies").create(payload);
        } else {
          const id = String(get(r, "id") || "").trim();
          const title = String(get(r, "title") || "").trim();
          if (!title) throw new Error("Название сделки обязательно");

          const companyName = String(get(r, "company_name") || "").trim();
          const companyInn = String(get(r, "company_inn") || "").trim();
          const companyId = await resolveCompanyId(companyName, companyInn);

          const stageName = String(get(r, "stage") || "").trim();
          const stageId = await resolveStageId(stageName);

          const num = (v: any) => {
            if (v === null || v === undefined) return undefined;
            const s0 = String(v ?? "").trim();
            if (!s0 || s0 === "-" || s0 === "—") return undefined;
            // keep digits, dot, comma, minus. remove currency symbols and text.
            const cleaned = s0.replace(/[^\d,\.\-]/g, "").replace(/\s+/g, "");
            if (!cleaned) return undefined;
            // normalize decimal comma
            const normalized = cleaned.replace(",", ".");
            const n = Number(normalized);
            return Number.isFinite(n) ? n : undefined;
          };

          const payload: any = {
            title,
            company_id: companyId,
            responsible_id: user?.id || undefined,
            stage_id: stageId || undefined,
            budget: num(get(r, "budget")),
            turnover: num(get(r, "turnover")),
            margin_percent: num(get(r, "margin_percent")),
            discount_percent: num(get(r, "discount_percent")),
            sales_channel: String(get(r, "sales_channel") || "").trim() || undefined,
            partner: String(get(r, "partner") || "").trim() || undefined,
            distributor: String(get(r, "distributor") || "").trim() || undefined,
            purchase_format: String(get(r, "purchase_format") || "").trim() || undefined,
            attraction_channel: String(get(r, "attraction_channel") || "").trim() || undefined,
            attraction_date: String(get(r, "attraction_date") || "").trim() || undefined,
            expected_payment_date: String(get(r, "expected_payment_date") || "").trim() || undefined,
            payment_received_date: String(get(r, "payment_received_date") || "").trim() || undefined,
          };

          // Fill dynamic fields by label (works идеально с нашим шаблоном)
          // NOTE: системные поля (title/company_id/stage_id/responsible_id) уже заданы выше — не трогаем их здесь.
          for (const [lbl, f] of dealFieldByLabel.entries()) {
            const fieldName = String(f?.field_name ?? "").trim();
            if (!fieldName) continue;
            if (["title", "company_id", "stage_id", "responsible_id"].includes(fieldName)) continue;

            const raw = (r as any)[lbl];
            if (raw === null || raw === undefined) continue;
            const s = String(raw).trim();
            if (!s || s === "-" || s === "—") continue;

            const ft = String(f?.field_type ?? f?.value_type ?? "").toLowerCase();

            if (ft === "number") payload[fieldName] = num(s);
            else if (ft === "checkbox" || ft === "bool" || ft === "boolean") {
              const v = s.toLowerCase();
              payload[fieldName] = v === "1" || v === "true" || v === "да" || v === "yes" || v === "y";
            } else if (ft === "relation") {
              // MVP: если пользователь указал ID — используем его; иначе пытаемся найти по name/title
              const maybeId = s;
              if (/^[a-z0-9]{15}$/.test(maybeId)) {
                payload[fieldName] = maybeId;
              } else {
                const opt = (f?.options ?? {}) as any;
                const relCollection = String(opt?.collection ?? "").trim();
                if (relCollection) {
                  const escaped = maybeId.replace(/"/g, "\\\"");
                  const found = await pb
                    .collection(relCollection)
                    .getList(1, 1, { filter: `name="${escaped}"` })
                    .then((x) => x.items?.[0])
                    .catch(() => null);
                  const found2 = found
                    ? found
                    : await pb
                        .collection(relCollection)
                        .getList(1, 1, { filter: `title="${escaped}"` })
                        .then((x) => x.items?.[0])
                        .catch(() => null);
                  if (found2) payload[fieldName] = (found2 as any).id;
                }
              }
            } else {
              // text/date/email/select etc
              payload[fieldName] = s;
            }
          }

          // Notes columns → timeline comments (separate records, 1..5)
          const notes: string[] = [];
          for (let i = 1; i <= 5; i++) {
            const v = (r as any)[`Примечание ${i}`];
            const s = v === null || v === undefined ? "" : String(v).trim();
            if (s) notes.push(s);
          }


          let dealRec: any = null;
          if (id) dealRec = await pb.collection("deals").update(id, payload);
          else dealRec = await pb.collection("deals").create(payload);

          const dealIdFinal = String(dealRec?.id ?? id);

          // persist notes into timeline as отдельные комментарии
          if (dealIdFinal && notes.length) {
            for (let i = 0; i < notes.length; i++) {
              const note = notes[i];
              await pb
                .collection("timeline")
                .create({
                  deal_id: dealIdFinal,
                  user_id: user?.id || pb.authStore.model?.id || null,
                  action: "comment",
                  comment: note,
                  payload: { source: "import", kind: "note", index: i + 1 },
                  timestamp: new Date().toISOString(),
                })
                .catch(() => {});
            }
          }
        }
        ok++;
      } catch (e: any) {
        errs.push({ row: rowNumber, error: e?.message ?? String(e), data: r });
      }
      setProgress(`Импорт: ${ok}/${rows.length}...`);
    }

    setErrors(errs);
    setResult({ ok, total: rows.length });
    setProgress("");
    setRunning(false);
  }

  const canRun = React.useMemo(() => {
    if (!rows.length) return false;
    if (entity === "deal") return Boolean(mapping.title) && (Boolean(mapping.company_name) || Boolean(mapping.company_inn));
    return Boolean(mapping.name);
  }, [rows.length, entity, mapping]);

  return (
    <Modal open={open} title="Импорт" onClose={onClose} widthClass="max-w-3xl">
      <div className="grid gap-4">
        {/* Step 1 */}
        {step === 1 ? (
          <div className="grid gap-3">
            <div className="text-sm font-semibold">1) Что импортируем?</div>
            <div className="flex gap-2">
              <Button variant={entity === "deal" ? "primary" : "secondary"} onClick={() => setEntity("deal")}>Сделки</Button>
              <Button variant={entity === "company" ? "primary" : "secondary"} onClick={() => setEntity("company")}>Компании</Button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-text2">Шаблон поможет сразу попасть в правильные поля.</div>
              <Button variant="secondary" onClick={downloadTemplate}>Скачать шаблон</Button>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Далее</Button>
            </div>
          </div>
        ) : null}

        {/* Step 2 */}
        {step === 2 ? (
          <div className="grid gap-3">
            <div className="text-sm font-semibold">2) Загрузите файл</div>
            <DropZone
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onFile={onPickFile}
              hint={entity === "deal" ? "Минимум: Название сделки + Компания (название или ИНН)." : "Минимум: Название компании."}
            />
            {progress ? <div className="text-sm text-text2">{progress}</div> : null}

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Назад</Button>
            </div>
          </div>
        ) : null}

        {/* Step 3 */}
        {step === 3 ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">3) Маппинг и предпросмотр</div>
                <div className="text-xs text-text2 mt-1">
                  Файл: <span className="font-medium text-text1">{file?.name}</span> · строк: {rows.length}
                </div>
              </div>
              <Button variant="secondary" onClick={() => setStep(2)}>Сменить файл</Button>
            </div>

            <div className="grid gap-3">
              {entity === "deal" ? (
                <>
                  <FieldRow label="ID (для массового обновления)" value={mapping.id || ""} onChange={(v) => setMapping((m) => ({ ...m, id: v }))} headers={headers} />
                  <FieldRow label="Название сделки" required value={mapping.title || ""} onChange={(v) => setMapping((m) => ({ ...m, title: v }))} headers={headers} />
                  <FieldRow label="Компания (название)" required={!mapping.company_inn} value={mapping.company_name || ""} onChange={(v) => setMapping((m) => ({ ...m, company_name: v }))} headers={headers} />
                  <FieldRow label="Компания (ИНН)" required={!mapping.company_name} value={mapping.company_inn || ""} onChange={(v) => setMapping((m) => ({ ...m, company_inn: v }))} headers={headers} />
                  <FieldRow label="Этап" value={mapping.stage || ""} onChange={(v) => setMapping((m) => ({ ...m, stage: v }))} headers={headers} />
                  <FieldRow label="Бюджет" value={mapping.budget || ""} onChange={(v) => setMapping((m) => ({ ...m, budget: v }))} headers={headers} />
                  <FieldRow label="Оборот" value={mapping.turnover || ""} onChange={(v) => setMapping((m) => ({ ...m, turnover: v }))} headers={headers} />
                  <FieldRow label="Маржа, %" value={mapping.margin_percent || ""} onChange={(v) => setMapping((m) => ({ ...m, margin_percent: v }))} headers={headers} />
                  <FieldRow label="Скидка, %" value={mapping.discount_percent || ""} onChange={(v) => setMapping((m) => ({ ...m, discount_percent: v }))} headers={headers} />
                  <FieldRow label="Канал продаж" value={mapping.sales_channel || ""} onChange={(v) => setMapping((m) => ({ ...m, sales_channel: v }))} headers={headers} />
                  <FieldRow label="Партнёр" value={mapping.partner || ""} onChange={(v) => setMapping((m) => ({ ...m, partner: v }))} headers={headers} />
                  <FieldRow label="Дистрибьютор" value={mapping.distributor || ""} onChange={(v) => setMapping((m) => ({ ...m, distributor: v }))} headers={headers} />
                  <FieldRow label="Формат закупки" value={mapping.purchase_format || ""} onChange={(v) => setMapping((m) => ({ ...m, purchase_format: v }))} headers={headers} />
                  <FieldRow label="Канал привлечения" value={mapping.attraction_channel || ""} onChange={(v) => setMapping((m) => ({ ...m, attraction_channel: v }))} headers={headers} />
                  <FieldRow label="Дата привлечения" value={mapping.attraction_date || ""} onChange={(v) => setMapping((m) => ({ ...m, attraction_date: v }))} headers={headers} />
                  <FieldRow label="Ожидаемая оплата" value={mapping.expected_payment_date || ""} onChange={(v) => setMapping((m) => ({ ...m, expected_payment_date: v }))} headers={headers} />
                  <FieldRow label="Фактическая оплата" value={mapping.payment_received_date || ""} onChange={(v) => setMapping((m) => ({ ...m, payment_received_date: v }))} headers={headers} />

                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input type="checkbox" checked={createCompanies} onChange={(e) => setCreateCompanies(e.target.checked)} />
                    Создавать новые компании, если не найдены по ИНН / названию
                  </label>
                </>
              ) : (
                <>
                  <FieldRow label="ID (для массового обновления)" value={mapping.id || ""} onChange={(v) => setMapping((m) => ({ ...m, id: v }))} headers={headers} />
                  <FieldRow label="Название компании" required value={mapping.name || ""} onChange={(v) => setMapping((m) => ({ ...m, name: v }))} headers={headers} />
                  <FieldRow label="ИНН" value={mapping.inn || ""} onChange={(v) => setMapping((m) => ({ ...m, inn: v }))} headers={headers} />
                  <FieldRow label="Город" value={mapping.city || ""} onChange={(v) => setMapping((m) => ({ ...m, city: v }))} headers={headers} />
                  <FieldRow label="Сайт" value={mapping.website || ""} onChange={(v) => setMapping((m) => ({ ...m, website: v }))} headers={headers} />
                  <FieldRow label="Телефон" value={mapping.phone || ""} onChange={(v) => setMapping((m) => ({ ...m, phone: v }))} headers={headers} />
                  <FieldRow label="Email" value={mapping.email || ""} onChange={(v) => setMapping((m) => ({ ...m, email: v }))} headers={headers} />
                  <FieldRow label="Юр. лицо" value={mapping.legal_entity || ""} onChange={(v) => setMapping((m) => ({ ...m, legal_entity: v }))} headers={headers} />
                  <FieldRow label="Адрес" value={mapping.address || ""} onChange={(v) => setMapping((m) => ({ ...m, address: v }))} headers={headers} />
                </>
              )}
            </div>

            {/* preview */}
            <div className="border border-border rounded-card overflow-hidden">
              <div className="px-3 py-2 text-xs text-text2 bg-tableHeader">Предпросмотр (первые 5 строк)</div>
              <div className="overflow-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-white border-b border-border">
                      {headers.slice(0, 8).map((h) => (
                        <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        {headers.slice(0, 8).map((h) => (
                          <td key={h} className="px-3 py-2 whitespace-nowrap">
                            {String(r[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {headers.length > 8 ? <div className="px-3 py-2 text-[11px] text-text2">Показаны первые 8 колонок.</div> : null}
            </div>

            {/* actions */}
            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(1)} disabled={running}>Начать заново</Button>
              <div className="flex items-center gap-2">
                {progress ? <div className="text-sm text-text2">{progress}</div> : null}
                <Button onClick={runImport} disabled={!canRun || running}>
                  {running ? "Импорт..." : "Запустить импорт"}
                </Button>
              </div>
            </div>

            {/* result */}
            {result ? (
              <div className="grid gap-2">
                <div className="text-sm">
                  Готово: <span className="font-semibold">{result.ok}</span> / {result.total}
                  {errors.length ? (
                    <span className="text-danger"> · Ошибок: {errors.length}</span>
                  ) : (
                    <span className="text-success"> · Без ошибок</span>
                  )}
                </div>
                {errors.length ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        downloadCsv(
                          errors.map((e) => ({ row: e.row, error: e.error })),
                          "import_errors.csv"
                        );
                      }}
                    >
                      Скачать лог ошибок (CSV)
                    </Button>
                    <Input
                      value={""}
                      onChange={() => {}}
                      placeholder={""}
                      className="hidden"
                    />
                  </div>
                ) : null}

                {errors.length ? (
                  <div className="border border-border rounded-card overflow-hidden">
                    <div className="px-3 py-2 text-xs text-text2 bg-tableHeader">Ошибки (первые 10)</div>
                    <div className="divide-y divide-border">
                      {errors.slice(0, 10).map((e, i) => (
                        <div key={i} className="px-3 py-2 text-xs">
                          <span className="font-semibold">Строка {e.row}:</span> {e.error}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
