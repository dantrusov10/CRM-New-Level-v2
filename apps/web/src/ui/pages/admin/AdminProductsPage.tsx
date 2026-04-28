import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";
import type { ProductProfile } from "../../data/hooks";

type ProductVariant = {
  name?: string;
  manufacturer?: string;
  website?: string;
  docs?: string;
  tz_passport?: string;
  lpr_map?: string;
  parsers_config?: string;
  ai_prompt_deal?: string;
  ai_prompt_client_research?: string;
  ai_prompt_tz_analysis?: string;
};

function parseVariants(raw: unknown): ProductVariant {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as ProductVariant;
  return {};
}

export function AdminProductsPage() {
  const [items, setItems] = React.useState<ProductProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [activeId, setActiveId] = React.useState("");
  const [status, setStatus] = React.useState("");

  const [name, setName] = React.useState("");
  const [manufacturer, setManufacturer] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [docs, setDocs] = React.useState("");
  const [tzPassport, setTzPassport] = React.useState("");
  const [lprMap, setLprMap] = React.useState("");
  const [parsersConfig, setParsersConfig] = React.useState("");
  const [promptDeal, setPromptDeal] = React.useState("");
  const [promptClientResearch, setPromptClientResearch] = React.useState("");
  const [promptTz, setPromptTz] = React.useState("");
  const [fileTag, setFileTag] = React.useState("docs");
  const [fileTitle, setFileTitle] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadError, setUploadError] = React.useState("");
  const [productFiles, setProductFiles] = React.useState<Array<{ id: string; filename: string; path: string; tag?: string }>>([]);

  async function load() {
    setLoading(true);
    try {
      const list = await pb.collection("semantic_packs").getList(1, 200, {
        filter: 'type="product_profile" && model="product_profile_v1"',
        sort: "-updated",
      }).catch(() => ({ items: [] as ProductProfile[] }));
      const rows = (list.items || []) as ProductProfile[];
      setItems(rows);
      if (!rows.length) {
        resetForm();
        return;
      }
      const nextId = activeId && rows.some((r) => r.id === activeId) ? activeId : rows[0].id;
      setActiveId(nextId);
      applyFromItem(rows.find((x) => x.id === nextId) || rows[0]);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setActiveId("");
    setName("");
    setManufacturer("");
    setWebsite("");
    setDocs("");
    setTzPassport("");
    setLprMap("");
    setParsersConfig("");
    setPromptDeal("");
    setPromptClientResearch("");
    setPromptTz("");
  }

  function applyFromItem(item: ProductProfile) {
    const v = parseVariants(item.variants);
    setName(String(v.name || ""));
    setManufacturer(String(v.manufacturer || ""));
    setWebsite(String(v.website || ""));
    setDocs(String(v.docs || ""));
    setTzPassport(String(v.tz_passport || ""));
    setLprMap(String(v.lpr_map || ""));
    setParsersConfig(String(v.parsers_config || ""));
    setPromptDeal(String(v.ai_prompt_deal || ""));
    setPromptClientResearch(String(v.ai_prompt_client_research || ""));
    setPromptTz(String(v.ai_prompt_tz_analysis || ""));
  }

  React.useEffect(() => {
    void load();
  }, []);

  React.useEffect(() => {
    const run = async () => {
      if (!activeId) {
        setProductFiles([]);
        return;
      }
      const links = await pb.collection("entity_files").getList(1, 200, {
        filter: `entity_type="product_profile" && entity_id="${activeId}"`,
        sort: "-created",
        expand: "file_id",
      }).catch(() => ({ items: [] as Array<Record<string, unknown>> }));
      const rows = ((links.items || []) as Array<Record<string, unknown>>).map((x) => {
        const file = x.expand && typeof x.expand === "object" ? (x.expand as Record<string, unknown>).file_id as Record<string, unknown> : null;
        return {
          id: String(x.id || ""),
          filename: String(file?.filename || "Файл"),
          path: String(file?.path || ""),
          tag: String(x.tag || ""),
        };
      });
      setProductFiles(rows);
    };
    void run();
  }, [activeId]);

  async function createNew() {
    setSaving(true);
    setStatus("");
    try {
      const rec = await pb.collection("semantic_packs").create({
        type: "product_profile",
        model: "product_profile_v1",
        language: "ru",
        base_text: "product_profile",
        variants: { name: "Новый продукт" },
      });
      setActiveId(String((rec as { id?: string }).id || ""));
      await load();
      setStatus("Новый профиль создан");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!activeId) return;
    setSaving(true);
    setStatus("");
    try {
      await pb.collection("semantic_packs").update(activeId, {
        type: "product_profile",
        model: "product_profile_v1",
        language: "ru",
        base_text: "product_profile",
        variants: {
          name: name.trim(),
          manufacturer: manufacturer.trim(),
          website: website.trim(),
          docs: docs.trim(),
          tz_passport: tzPassport.trim(),
          lpr_map: lprMap.trim(),
          parsers_config: parsersConfig.trim(),
          ai_prompt_deal: promptDeal.trim(),
          ai_prompt_client_research: promptClientResearch.trim(),
          ai_prompt_tz_analysis: promptTz.trim(),
        },
      });
      await load();
      setStatus("Сохранено");
    } finally {
      setSaving(false);
    }
  }

  async function addProductFileByUrl() {
    if (!activeId || !fileUrl.trim()) return;
    setUploadError("");
    const title = fileTitle.trim() || fileUrl.split("/").pop() || "file";
    const file = await pb.collection("files").create({
      path: fileUrl.trim(),
      filename: title,
      mime: "text/uri-list",
      size_bytes: 0,
    }).catch(() => null);
    if (!file?.id) {
      setUploadError("Не удалось сохранить файл по URL.");
      return;
    }
    await pb.collection("entity_files").create({
      entity_type: "product_profile",
      entity_id: activeId,
      file_id: file.id,
      tag: fileTag,
      created_at: new Date().toISOString(),
    }).catch(() => null);
    setFileUrl("");
    setFileTitle("");
    const links = await pb.collection("entity_files").getList(1, 200, {
      filter: `entity_type="product_profile" && entity_id="${activeId}"`,
      sort: "-created",
      expand: "file_id",
    }).catch(() => ({ items: [] as Array<Record<string, unknown>> }));
    setProductFiles(((links.items || []) as Array<Record<string, unknown>>).map((x) => {
      const f = x.expand && typeof x.expand === "object" ? (x.expand as Record<string, unknown>).file_id as Record<string, unknown> : null;
      return { id: String(x.id || ""), filename: String(f?.filename || "Файл"), path: String(f?.path || ""), tag: String(x.tag || "") };
    }));
  }

  async function addProductUploadedFile() {
    if (!activeId || !uploadFile) return;
    setUploadError("");
    const readAsDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsDataURL(file);
      });
    try {
      const dataUrl = await readAsDataUrl(uploadFile);
      const title = fileTitle.trim() || uploadFile.name;
      const file = await pb.collection("files").create({
        path: dataUrl,
        filename: title,
        mime: uploadFile.type || "application/octet-stream",
        size_bytes: uploadFile.size || 0,
      }).catch(() => null);
      if (!file?.id) throw new Error("Не удалось загрузить файл");
      await pb.collection("entity_files").create({
        entity_type: "product_profile",
        entity_id: activeId,
        file_id: file.id,
        tag: fileTag,
        created_at: new Date().toISOString(),
      }).catch(() => null);
      setUploadFile(null);
      setFileTitle("");
      const links = await pb.collection("entity_files").getList(1, 200, {
        filter: `entity_type="product_profile" && entity_id="${activeId}"`,
        sort: "-created",
        expand: "file_id",
      }).catch(() => ({ items: [] as Array<Record<string, unknown>> }));
      setProductFiles(((links.items || []) as Array<Record<string, unknown>>).map((x) => {
        const f = x.expand && typeof x.expand === "object" ? (x.expand as Record<string, unknown>).file_id as Record<string, unknown> : null;
        return { id: String(x.id || ""), filename: String(f?.filename || "Файл"), path: String(f?.path || ""), tag: String(x.tag || "") };
      }));
    } catch {
      setUploadError("Не удалось загрузить файл. Попробуйте файл меньшего размера.");
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-base font-extrabold tracking-wide">Настройка продуктов</div>
              <div className="text-xs text-text2 mt-1">
                Неограниченное число продуктовых профилей: паспорт, карты ЛПР, документы и отдельные AI-промпты.
              </div>
            </div>
            <Button onClick={createNew} disabled={saving}>+ Продукт</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-text2">Загрузка...</div> : (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 xl:col-span-3">
                <div className="rounded-card border border-border bg-rowHover p-3 grid gap-2">
                  {(items || []).map((item) => {
                    const v = parseVariants(item.variants);
                    const title = String(v.name || "Без названия");
                    return (
                      <button
                        key={item.id}
                        className={`text-left rounded-md border px-3 py-2 text-sm ${
                          item.id === activeId ? "border-primary/60 bg-[rgba(51,215,255,0.14)]" : "border-border bg-white"
                        }`}
                        onClick={() => {
                          setActiveId(item.id);
                          applyFromItem(item);
                        }}
                      >
                        {title}
                      </button>
                    );
                  })}
                  {!items.length ? <div className="text-xs text-text2">Пока нет профилей.</div> : null}
                </div>
              </div>
              <div className="col-span-12 xl:col-span-9">
                <div className="grid gap-3">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 md:col-span-6">
                      <div className="text-xs text-text2 mb-1">Название продукта</div>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: NewLevel SOC" />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <div className="text-xs text-text2 mb-1">Производитель</div>
                      <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Например: NewLevel Labs" />
                    </div>
                    <div className="col-span-12">
                      <div className="text-xs text-text2 mb-1">Сайт продукта</div>
                      <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
                    </div>
                  </div>

                  <TextArea label="Документация / материалы" value={docs} onChange={setDocs} />
                  <TextArea label="Паспорт / ТЗ продукта" value={tzPassport} onChange={setTzPassport} />
                  <TextArea label="Карта ЛПР / роли и веса" value={lprMap} onChange={setLprMap} />
                  <TextArea label="Конфигурация парсеров (медиа/контакты/тендеры)" value={parsersConfig} onChange={setParsersConfig} />
                  <TextArea label="AI промпт: анализ сделки" value={promptDeal} onChange={setPromptDeal} />
                  <TextArea label="AI промпт: исследование клиента" value={promptClientResearch} onChange={setPromptClientResearch} />
                  <TextArea label="AI промпт: анализ ТЗ" value={promptTz} onChange={setPromptTz} />

                  <div className="rounded-card border border-border bg-rowHover p-3">
                    <div className="text-sm font-semibold">Файлы продукта по блокам</div>
                    <div className="text-xs text-text2 mt-1">Можно прикладывать файлы к каждому блоку: документация, паспорт/ТЗ, карта ЛПР, парсеры, AI.</div>
                    <div className="mt-3 grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-3">
                        <div className="text-xs text-text2 mb-1">Блок</div>
                        <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={fileTag} onChange={(e) => setFileTag(e.target.value)}>
                          <option value="docs">Документация</option>
                          <option value="tz_passport">Паспорт / ТЗ</option>
                          <option value="lpr_map">Карта ЛПР</option>
                          <option value="parsers_config">Парсеры</option>
                          <option value="ai_prompt">AI</option>
                        </select>
                      </div>
                      <div className="col-span-12 md:col-span-4">
                        <div className="text-xs text-text2 mb-1">Название файла</div>
                        <Input value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} placeholder="Например: Паспорт v2" />
                      </div>
                      <div className="col-span-12 md:col-span-5">
                        <div className="text-xs text-text2 mb-1">URL файла</div>
                        <div className="flex gap-2">
                          <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
                          <Button variant="secondary" onClick={addProductFileByUrl} disabled={!activeId || !fileUrl.trim()}>Добавить URL</Button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="ui-btn ui-btn-secondary h-9 px-3 cursor-pointer">
                        Загрузить файл
                        <input type="file" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                      </label>
                      <div className="text-xs text-text2">{uploadFile ? `Выбран: ${uploadFile.name}` : "Файл не выбран"}</div>
                      <Button onClick={addProductUploadedFile} disabled={!activeId || !uploadFile}>Сохранить файл</Button>
                    </div>
                    {uploadError ? <div className="text-xs text-danger mt-2">{uploadError}</div> : null}
                    <div className="mt-3 grid gap-2">
                      {productFiles.map((f) => (
                        <div key={f.id} className="rounded-md border border-border bg-white p-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{f.filename}</div>
                            <div className="text-xs text-text2">{f.tag || "без тега"}</div>
                          </div>
                          <a className="text-sm text-primary underline" href={f.path} target="_blank" rel="noreferrer">Скачать</a>
                        </div>
                      ))}
                      {!productFiles.length ? <div className="text-xs text-text2">Файлы пока не добавлены.</div> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button onClick={save} disabled={!activeId || saving || !name.trim()}>Сохранить продукт</Button>
                    {status ? <span className="text-sm text-success">{status}</span> : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs text-text2 mb-1">{label}</div>
      <textarea
        className="w-full rounded-card border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
