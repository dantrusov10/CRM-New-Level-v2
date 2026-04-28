import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";
import { KpTemplateEditor } from "../../modules/kp/KpTemplateEditor";
import { DEFAULT_KP_TEMPLATE_V1 } from "../../modules/kp/defaultTemplate";
import { PriceListAdmin } from "../../modules/kp/PriceListAdmin";
import type { KpTemplateConfig, KpTemplateRecord } from "../../modules/kp/types";

type Tab = "contacts" | "media" | "tenders" | "ai" | "kp";

type TabButtonProps = { active: boolean; children: React.ReactNode; onClick: () => void };
type ParserKeywordBag = { phrases?: string[] };
type ContactParserSettings = { id: string; enabled?: boolean; schedule_cron?: string; sources_policy?: string; role_map_id?: string | null };
type RoleMap = { id: string; title: string; segment: string };
type RoleMapItem = { id: string; position_title: string; influence_type: string; weight?: number; is_active?: boolean };
type MediaParserSettings = { id: string; enabled?: boolean; schedule_cron?: string; keywords?: ParserKeywordBag };
type MediaSource = { id: string; name: string; is_official?: boolean };
type MediaLink = { id: string; source_id: string };
type TenderParserSettings = { id: string; enabled?: boolean; schedule_cron?: string; keywords?: ParserKeywordBag; platform_tokens?: Record<string, unknown> };
type TenderPlatform = { id: string; name: string; integration_type?: string };
type TenderLink = { id: string; platform_id: string };
type ProductProfileItem = { id: string; variants?: Record<string, unknown> };

type KpTemplatePatch = { template_json?: KpTemplateConfig; name?: string };
type DealScoringFactor = { code: string; name: string; weight: number; enabled: boolean };
type DealScoringModel = { version: string; recommended: boolean; acknowledged?: boolean; factors: DealScoringFactor[] };

const DEFAULT_DEAL_SCORING_MODEL: DealScoringModel = {
  version: "v1",
  recommended: true,
  acknowledged: false,
  factors: [
    { code: "stage_progress", name: "Прогресс этапа", weight: 22, enabled: true },
    { code: "decision_maker_coverage", name: "Покрытие ЛПР/ЛВР", weight: 18, enabled: true },
    { code: "activity_freshness", name: "Свежесть активности", weight: 14, enabled: true },
    { code: "budget_clarity", name: "Определенность бюджета", weight: 14, enabled: true },
    { code: "pilot_status", name: "Статус пилота/пресейла", weight: 12, enabled: true },
    { code: "competition_pressure", name: "Конкурентное давление", weight: 10, enabled: true },
    { code: "data_completeness", name: "Полнота данных сделки", weight: 10, enabled: true },
  ],
};

export function AdminParsersPage() {
  const [tab, setTab] = React.useState<Tab>("contacts");
  const [guidedMode, setGuidedMode] = React.useState(true);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-base font-extrabold tracking-wide">Парсеры и AI-настройки</div>
              <div className="text-xs text-text2 mt-1">Контакты, медиа, тендеры, AI-промпт и КП-конфигурация</div>
            </div>
            <Button small variant="secondary" onClick={() => setGuidedMode((v) => !v)}>
              {guidedMode ? "Скрыть подсказки" : "Пошаговый режим"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {guidedMode ? (
            <div className="board-panel p-3 mb-3 neon-accent">
              <div className="text-sm font-semibold">Рекомендуемый порядок</div>
              <div className="mt-2 grid gap-1.5 text-xs text-text2">
                <div><b>1.</b> Настрой карту контактов и влияние ролей.</div>
                <div><b>2.</b> Подключи источники медиа/тендеров и проверь ключевые слова.</div>
                <div><b>3.</b> Скорректируй AI-промпт и факторы скоринга, затем сделай smoke-run на тестовой сделке.</div>
              </div>
            </div>
          ) : null}
          <div className="flex gap-2 flex-wrap">
            <TabButton active={tab==="contacts"} onClick={() => setTab("contacts")}>Контакты</TabButton>
            <TabButton active={tab==="media"} onClick={() => setTab("media")}>Медиа</TabButton>
            <TabButton active={tab==="tenders"} onClick={() => setTab("tenders")}>Тендеры</TabButton>
            <TabButton active={tab==="ai"} onClick={() => setTab("ai")}>Настройка AI</TabButton>
            <TabButton active={tab==="kp"} onClick={() => setTab("kp")}>КП (каркас)</TabButton>
          </div>
        </CardContent>
      </Card>

      {tab === "contacts" ? <ContactsParser /> : null}
      {tab === "media" ? <MediaParser /> : null}
      {tab === "tenders" ? <TenderParser /> : null}
      {tab === "ai" ? <AiPromptsSettings /> : null}
      {tab === "kp" ? <KpSettings /> : null}
    </div>
  );
}

function ParserAiControls({ parserKey }: { parserKey: "contacts" | "media" | "tenders" }) {
  const [recordId, setRecordId] = React.useState("");
  const [products, setProducts] = React.useState<Array<{ id: string; name: string }>>([]);
  const [productId, setProductId] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [status, setStatus] = React.useState("");

  async function load() {
    const productRows = await pb.collection("semantic_packs").getList(1, 200, {
      filter: 'model="product_profile_v1"',
      sort: "-updated",
    }).catch(() => ({ items: [] as ProductProfileItem[] }));
    const mapped = (productRows.items || []).map((p: ProductProfileItem) => ({
      id: p.id,
      name: String((p.variants && typeof p.variants === "object" ? (p.variants as Record<string, unknown>).name : "") || "Без названия"),
    }));
    setProducts(mapped);
    if (!productId && mapped[0]) setProductId(mapped[0].id);

    const pack = await pb.collection("semantic_packs").getList(1, 1, {
      filter: 'type="parser_ai_settings" && model="parser_ai_settings_v1"',
      sort: "-updated",
    }).catch(() => ({ items: [] as Array<Record<string, unknown>> }));
    const item = (pack.items || [])[0] as Record<string, unknown> | undefined;
    if (!item) return;
    setRecordId(String(item.id || ""));
    const variants = item.variants && typeof item.variants === "object" ? item.variants as Record<string, unknown> : {};
    const section = variants[parserKey] && typeof variants[parserKey] === "object" ? variants[parserKey] as Record<string, unknown> : {};
    setPrompt(String(section.prompt || ""));
    const byProduct = section.enrich_by_product && typeof section.enrich_by_product === "object" ? section.enrich_by_product as Record<string, unknown> : {};
    const pid = productId || mapped[0]?.id || "";
    setEnabled(Boolean(byProduct[pid] ?? true));
  }

  React.useEffect(() => {
    void load();
  }, []);

  React.useEffect(() => {
    const run = async () => {
      if (!productId) return;
      const pack = await pb.collection("semantic_packs").getList(1, 1, {
        filter: 'type="parser_ai_settings" && model="parser_ai_settings_v1"',
        sort: "-updated",
      }).catch(() => ({ items: [] as Array<Record<string, unknown>> }));
      const item = (pack.items || [])[0] as Record<string, unknown> | undefined;
      if (!item) return;
      const variants = item.variants && typeof item.variants === "object" ? item.variants as Record<string, unknown> : {};
      const section = variants[parserKey] && typeof variants[parserKey] === "object" ? variants[parserKey] as Record<string, unknown> : {};
      const byProduct = section.enrich_by_product && typeof section.enrich_by_product === "object" ? section.enrich_by_product as Record<string, unknown> : {};
      setEnabled(Boolean(byProduct[productId] ?? true));
      setPrompt(String(section.prompt || ""));
    };
    void run();
  }, [productId, parserKey]);

  async function save() {
    if (!productId) return;
    setStatus("");
    const pack = await pb.collection("semantic_packs").getList(1, 1, {
      filter: 'type="parser_ai_settings" && model="parser_ai_settings_v1"',
      sort: "-updated",
    }).catch(() => ({ items: [] as Array<Record<string, unknown>> }));
    const item = (pack.items || [])[0] as Record<string, unknown> | undefined;
    const root = item?.variants && typeof item.variants === "object" ? item.variants as Record<string, unknown> : {};
    const currentSection = root[parserKey] && typeof root[parserKey] === "object" ? root[parserKey] as Record<string, unknown> : {};
    const byProduct = currentSection.enrich_by_product && typeof currentSection.enrich_by_product === "object"
      ? currentSection.enrich_by_product as Record<string, unknown>
      : {};
    byProduct[productId] = enabled;
    root[parserKey] = {
      ...currentSection,
      prompt: prompt.trim(),
      enrich_by_product: byProduct,
    };
    const payload = {
      type: "parser_ai_settings",
      model: "parser_ai_settings_v1",
      language: "ru",
      base_text: "Parser AI enrichment settings",
      variants: root,
    };
    if (item?.id) {
      await pb.collection("semantic_packs").update(String(item.id), payload);
      setRecordId(String(item.id));
    } else {
      const created = await pb.collection("semantic_packs").create(payload);
      setRecordId(String((created as { id?: string }).id || ""));
    }
    setStatus("Сохранено");
    setTimeout(() => setStatus(""), 2000);
  }

  return (
    <div className="rounded-card border border-border bg-rowHover p-3">
      <div className="text-sm font-semibold">AI-обогащение по продуктам</div>
      <div className="mt-2 grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-4">
          <div className="text-xs text-text2 mb-1">Продукт</div>
          <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">—</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-4 flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Включить ИИ для обогащения
          </label>
        </div>
      </div>
      <div className="mt-2">
        <div className="text-xs text-text2 mb-1">Промт (общий для этого парсера)</div>
        <textarea
          className="w-full rounded-card border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Вставь промт для AI-обогащения"
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button onClick={save} disabled={!productId}>Сохранить AI-настройку</Button>
        {status ? <span className="text-sm text-success">{status}</span> : null}
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }: TabButtonProps) {
  return (
    <button
      className={
        "h-9 rounded-md px-3 text-sm border transition-colors " +
        (active
          ? "bg-[rgba(51,215,255,0.24)] border-[rgba(51,215,255,0.55)] shadow-[0_0_14px_rgba(51,215,255,0.18)]"
          : "bg-white border-border hover:bg-[rgba(51,215,255,0.14)]")
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** CONTACTS */
function ContactsParser() {
  const [settings, setSettings] = React.useState<ContactParserSettings | null>(null);
  const [maps, setMaps] = React.useState<RoleMap[]>([]);
  const [items, setItems] = React.useState<RoleMapItem[]>([]);
  const [title, setTitle] = React.useState("");
  const [segment, setSegment] = React.useState("default");
  const [currentMap, setCurrentMap] = React.useState<string>("");

  const [pos, setPos] = React.useState("");
  const [influence, setInfluence] = React.useState("lpr");
  const [weight, setWeight] = React.useState("1");

  async function load() {
    const sList = await pb.collection("settings_contact_parser").getList(1, 1).catch(() => ({ items: [] as ContactParserSettings[] }));
    const s = sList.items[0] ?? (await pb.collection("settings_contact_parser").create({ enabled: true, schedule_cron: "0 9 * * *", sources_policy: "official_only" }));
    setSettings(s);

    const m = await pb.collection("role_maps").getFullList({ sort: "-created" });
    setMaps(m as RoleMap[]);

    const mapId = s.role_map_id ?? (m[0] as RoleMap | undefined)?.id ?? "";
    setCurrentMap(mapId);
    if (mapId) {
      const it = await pb.collection("role_map_items").getFullList({ filter: `role_map_id="${mapId}"`, sort: "-is_active, -weight, position_title" });
      setItems(it as RoleMapItem[]);
    } else {
      setItems([]);
    }
  }

  React.useEffect(() => { load(); }, []);

  async function saveSettings(patch: Partial<ContactParserSettings>) {
    const upd = await pb.collection("settings_contact_parser").update(settings.id, patch);
    setSettings(upd);
  }

  async function createMap() {
    const m = await pb.collection("role_maps").create({ title, segment });
    setTitle(""); setSegment("default");
    await pb.collection("settings_contact_parser").update(settings.id, { role_map_id: m.id });
    load();
  }

  async function addItem() {
    if (!currentMap || !pos.trim()) return;
    await pb.collection("role_map_items").create({
      role_map_id: currentMap,
      position_title: pos,
      influence_type: influence,
      weight: Number(weight || 1),
      is_active: true,
    });
    setPos(""); setWeight("1");
    load();
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Парсер контактов (ЛПР/ЛВР)</div>
        <div className="text-xs text-text2 mt-1">Админ задаёт карту ролей: должности и зоны влияния на покупку (ЛПР/ЛВР/блокер/инфлюенсер)</div>
      </CardHeader>
      <CardContent>
        {!settings ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : (
          <div className="grid gap-4">
            <ParserAiControls parserKey="contacts" />
            <div className="grid grid-cols-4 gap-3">
              <label className="flex items-center gap-2 text-sm col-span-1">
                <input type="checkbox" checked={!!settings.enabled} onChange={(e) => saveSettings({ enabled: e.target.checked })} />
                Включен
              </label>
              <div className="col-span-1">
                <div className="text-xs text-text2 mb-1">Cron</div>
                <Input value={settings.schedule_cron ?? ""} onChange={(e) => saveSettings({ schedule_cron: e.target.value })} />
              </div>
              <div className="col-span-2">
                <div className="text-xs text-text2 mb-1">Политика источников</div>
                <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={settings.sources_policy ?? "official_only"} onChange={(e) => saveSettings({ sources_policy: e.target.value })}>
                  <option value="official_only">Только официальные источники</option>
                  <option value="official_plus_public">Официальные + публичные профили (нужна верификация)</option>
                  <option value="no_store_contacts">Не хранить контакты — только подсказки ролей</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_280px] gap-4">
              <div className="rounded-card border border-border bg-rowHover p-3">
                <div className="text-sm font-semibold mb-2">Карта ролей</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <div className="text-xs text-text2 mb-1">Выбор карты</div>
                    <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={currentMap} onChange={async (e) => {
                      const v = e.target.value;
                      setCurrentMap(v);
                      await pb.collection("settings_contact_parser").update(settings.id, { role_map_id: v || null });
                      load();
                    }}>
                      <option value="">—</option>
                      {maps.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.segment})</option>)}
                    </select>
                  </div>
                  <div className="col-span-1 flex items-end">
                    <Button variant="secondary" onClick={load}>Обновить</Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 items-end">
                  <div className="col-span-2">
                    <div className="text-xs text-text2 mb-1">Должность</div>
                    <Input value={pos} onChange={(e) => setPos(e.target.value)} placeholder="CIO / ИТ-директор" />
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Тип</div>
                    <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={influence} onChange={(e) => setInfluence(e.target.value)}>
                      <option value="lpr">ЛПР</option>
                      <option value="lvr">ЛВР</option>
                      <option value="blocker">Блокер</option>
                      <option value="influencer">Инфлюенсер</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Вес</div>
                    <Input value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </div>
                  <div className="col-span-4 flex justify-end">
                    <Button onClick={addItem} disabled={!currentMap || !pos.trim()}>Добавить</Button>
                  </div>
                </div>

                <div className="mt-4 overflow-auto">
                  <table className="min-w-[800px] w-full text-sm">
                    <thead>
                      <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                        <th className="text-left px-3">Должность</th>
                        <th className="text-left px-3">Тип</th>
                        <th className="text-left px-3">Вес</th>
                        <th className="text-left px-3">Активно</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="h-11 border-b border-border">
                          <td className="px-3">{it.position_title}</td>
                          <td className="px-3 text-text2">{it.influence_type}</td>
                          <td className="px-3 text-text2">{it.weight}</td>
                          <td className="px-3">
                            <input type="checkbox" checked={!!it.is_active} onChange={async (e) => {
                              await pb.collection("role_map_items").update(it.id, { is_active: e.target.checked });
                              load();
                            }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!items.length ? <div className="text-sm text-text2 py-4">Пока пусто.</div> : null}
                </div>
              </div>

              <div className="rounded-card border border-border bg-rowHover p-3">
                <div className="text-sm font-semibold mb-2">Создать новую карту</div>
                <div className="grid gap-2">
                  <div>
                    <div className="text-xs text-text2 mb-1">Название</div>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enterprise IT (RU)" />
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Сегмент</div>
                    <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="enterprise" />
                  </div>
                  <Button onClick={createMap} disabled={!title.trim()}>Создать и назначить</Button>
                  <div className="text-xs text-text2">AI-обогащение вариаций должностей хранится в `semantic_packs` (type=role_variants).</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** MEDIA */
function MediaParser() {
  const [settings, setSettings] = React.useState<MediaParserSettings | null>(null);
  const [sources, setSources] = React.useState<MediaSource[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [keywords, setKeywords] = React.useState("");

  async function load() {
    const sList = await pb.collection("settings_media_parser").getList(1, 1).catch(() => ({ items: [] as MediaParserSettings[] }));
    const s = sList.items[0] ?? (await pb.collection("settings_media_parser").create({ enabled: true, schedule_cron: "0 9 * * *", keywords: { phrases: [] } }));
    setSettings(s);

    const src = await pb.collection("parser_sources_media").getFullList({ filter: "is_active=true", sort: "name" });
    setSources(src as MediaSource[]);

    const links = await pb.collection("settings_media_parser_sources").getFullList({ filter: `settings_id="${s.id}"` }).catch(() => []);
    setSelected(new Set((links as MediaLink[]).map((l) => l.source_id)));
    setKeywords((s.keywords?.phrases ?? []).join(", "));
  }

  React.useEffect(() => { load(); }, []);

  async function saveSettings(patch: Partial<MediaParserSettings>) {
    const upd = await pb.collection("settings_media_parser").update(settings.id, patch);
    setSettings(upd);
  }

  async function toggleSource(id: string, on: boolean) {
    if (on) {
      await pb.collection("settings_media_parser_sources").create({ settings_id: settings.id, source_id: id });
    } else {
      const rec = await pb.collection("settings_media_parser_sources").getFirstListItem(`settings_id="${settings.id}" && source_id="${id}"`).catch(() => null);
      if (rec) await pb.collection("settings_media_parser_sources").delete(rec.id);
    }
    load();
  }

  async function saveKeywords() {
    const phrases = keywords.split(",").map((s) => s.trim()).filter(Boolean);
    await saveSettings({ keywords: { phrases } });
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Медиа-парсер</div>
        <div className="text-xs text-text2 mt-1">Выбор медиа из списка + ключевые слова (AI затем отбирает релевантные статьи)</div>
      </CardHeader>
      <CardContent>
        {!settings ? <div className="text-sm text-text2">Загрузка...</div> : (
          <div className="grid gap-4">
            <ParserAiControls parserKey="media" />
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!settings.enabled} onChange={(e) => saveSettings({ enabled: e.target.checked })} />
                Включен
              </label>
              <div>
                <div className="text-xs text-text2 mb-1">Cron</div>
                <Input value={settings.schedule_cron ?? ""} onChange={(e) => saveSettings({ schedule_cron: e.target.value })} />
              </div>
              <div />
            </div>

            <div className="rounded-card border border-border bg-rowHover p-3">
              <div className="text-sm font-semibold mb-2">Источники</div>
              <div className="grid grid-cols-3 gap-2">
                {sources.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm rounded-card border border-border bg-white px-3 py-2 hover:bg-rowHover">
                      <input type="checkbox" checked={on} onChange={(e) => toggleSource(s.id, e.target.checked)} />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-xs text-text2">{s.is_official ? "официально" : "публично"}</span>
                    </label>
                  );
                })}
              </div>
              {!sources.length ? <div className="text-sm text-text2">Список источников пуст — заполните `parser_sources_media`.</div> : null}
            </div>

            <div className="rounded-card border border-border bg-rowHover p-3">
              <div className="text-sm font-semibold mb-2">Ключевые слова</div>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="закупка, тендер, импортозамещение..." />
              <div className="flex justify-end mt-2">
                <Button onClick={saveKeywords}>Сохранить</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** TENDERS */
function TenderParser() {
  const [settings, setSettings] = React.useState<TenderParserSettings | null>(null);
  const [platforms, setPlatforms] = React.useState<TenderPlatform[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [keywords, setKeywords] = React.useState("");

  async function load() {
    const sList = await pb.collection("settings_tender_parser").getList(1, 1).catch(() => ({ items: [] as TenderParserSettings[] }));
    const s = sList.items[0] ?? (await pb.collection("settings_tender_parser").create({ enabled: true, schedule_cron: "0 9 * * *", keywords: { phrases: [] }, platform_tokens: {} }));
    setSettings(s);

    const p = await pb.collection("parser_sources_tender").getFullList({ filter: "is_active=true", sort: "name" });
    setPlatforms(p as TenderPlatform[]);

    const links = await pb.collection("settings_tender_parser_platforms").getFullList({ filter: `settings_id="${s.id}"` }).catch(() => []);
    setSelected(new Set((links as TenderLink[]).map((l) => l.platform_id)));
    setKeywords((s.keywords?.phrases ?? []).join(", "));
  }

  React.useEffect(() => { load(); }, []);

  async function saveSettings(patch: Partial<TenderParserSettings>) {
    const upd = await pb.collection("settings_tender_parser").update(settings.id, patch);
    setSettings(upd);
  }

  async function togglePlatform(id: string, on: boolean) {
    if (on) {
      await pb.collection("settings_tender_parser_platforms").create({ settings_id: settings.id, platform_id: id });
    } else {
      const rec = await pb.collection("settings_tender_parser_platforms").getFirstListItem(`settings_id="${settings.id}" && platform_id="${id}"`).catch(() => null);
      if (rec) await pb.collection("settings_tender_parser_platforms").delete(rec.id);
    }
    load();
  }

  async function saveKeywords() {
    const phrases = keywords.split(",").map((s) => s.trim()).filter(Boolean);
    await saveSettings({ keywords: { phrases } });
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Тендерный парсер</div>
        <div className="text-xs text-text2 mt-1">Выбор площадок + токены/логины + ключевые слова</div>
      </CardHeader>
      <CardContent>
        {!settings ? <div className="text-sm text-text2">Загрузка...</div> : (
          <div className="grid gap-4">
            <ParserAiControls parserKey="tenders" />
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!settings.enabled} onChange={(e) => saveSettings({ enabled: e.target.checked })} />
                Включен
              </label>
              <div>
                <div className="text-xs text-text2 mb-1">Cron</div>
                <Input value={settings.schedule_cron ?? ""} onChange={(e) => saveSettings({ schedule_cron: e.target.value })} />
              </div>
              <div />
            </div>

            <div className="rounded-card border border-border bg-rowHover p-3">
              <div className="text-sm font-semibold mb-2">Площадки</div>
              <div className="grid grid-cols-3 gap-2">
                {platforms.map((p) => {
                  const on = selected.has(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-sm rounded-card border border-border bg-white px-3 py-2 hover:bg-rowHover">
                      <input type="checkbox" checked={on} onChange={(e) => togglePlatform(p.id, e.target.checked)} />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-xs text-text2">{p.integration_type}</span>
                    </label>
                  );
                })}
              </div>
              {!platforms.length ? <div className="text-sm text-text2">Список площадок пуст — заполните `parser_sources_tender`.</div> : null}
            </div>

            <div className="rounded-card border border-border bg-rowHover p-3">
              <div className="text-sm font-semibold mb-2">Ключевые слова</div>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="CRM, CMDB, инвентаризация..." />
              <div className="flex justify-end mt-2">
                <Button onClick={saveKeywords}>Сохранить</Button>
              </div>
            </div>

            <div className="rounded-card border border-border bg-rowHover p-3">
              <div className="text-sm font-semibold mb-2">Токены доступа</div>
              <div className="text-sm text-text2">
                Для безопасности токены площадок не хранятся во фронте и не записываются в PocketBase.
                Храните их только на сервере в переменных окружения (см. `backend/pocketbase/SECRETS.example.md`).
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** AI PROMPTS (tenant-level) */
function AiPromptsSettings() {
  const [loading, setLoading] = React.useState(true);
  const [dealPromptId, setDealPromptId] = React.useState<string>("");
  const [clientPromptId, setClientPromptId] = React.useState<string>("");
  const [tzPromptId, setTzPromptId] = React.useState<string>("");
  const [prompt, setPrompt] = React.useState("");
  const [clientPrompt, setClientPrompt] = React.useState("");
  const [tzPrompt, setTzPrompt] = React.useState("");
  const [scoringRecordId, setScoringRecordId] = React.useState<string>("");
  const [scoringModel, setScoringModel] = React.useState<DealScoringModel>(DEFAULT_DEAL_SCORING_MODEL);
  const [status, setStatus] = React.useState("");

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const list = await pb.collection("semantic_packs").getList(1, 1, {
        filter: 'type="deal" && model="deal_analysis_prompt" && (language="ru" || language="")',
        sort: "-created",
      });
      const item = list.items[0] as { id: string; base_text?: string } | undefined;
      if (item) {
        setDealPromptId(item.id);
        setPrompt(item.base_text || "");
      } else {
        setDealPromptId("");
        setPrompt(
          "Проанализируй сделку с учетом всех полей карточки, истории комментариев, заметок, динамики событий и прошлых AI-оценок. Верни четкий вывод по вероятности закрытия, рискам и следующим шагам."
        );
      }
      const clientList = await pb.collection("semantic_packs").getList(1, 1, {
        filter: 'type="deal" && model="client_research_prompt" && (language="ru" || language="")',
        sort: "-created",
      }).catch(() => ({ items: [] as Array<{ id: string; base_text?: string }> }));
      const clientItem = clientList.items[0];
      if (clientItem) {
        setClientPromptId(clientItem.id);
        setClientPrompt(clientItem.base_text || "");
      } else {
        setClientPromptId("");
        setClientPrompt("Исследуй клиента по открытым источникам и данным CRM, выдели подтвержденные факты, ЛПР/ЛВР, риски и рекомендации для входа.");
      }
      const tzList = await pb.collection("semantic_packs").getList(1, 1, {
        filter: 'type="deal" && model="tz_analysis_prompt" && (language="ru" || language="")',
        sort: "-created",
      }).catch(() => ({ items: [] as Array<{ id: string; base_text?: string }> }));
      const tzItem = tzList.items[0];
      if (tzItem) {
        setTzPromptId(tzItem.id);
        setTzPrompt(tzItem.base_text || "");
      } else {
        setTzPromptId("");
        setTzPrompt("Сравни ТЗ клиента с паспортом продукта, выдели fit/gap, блокеры, вероятность прохождения и шаги по доработке КП.");
      }

      const scoringList = await pb.collection("semantic_packs").getList(1, 1, {
        filter: 'type="deal_scoring_model" && model="deal_scoring_model_v1"',
        sort: "-created",
      });
      const scoringItem = scoringList.items[0] as { id: string; variants?: unknown } | undefined;
      if (scoringItem) {
        setScoringRecordId(scoringItem.id);
        const raw = scoringItem.variants;
        let parsed: DealScoringModel | null = null;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          parsed = raw as DealScoringModel;
        } else if (typeof raw === "string" && raw.trim()) {
          try {
            parsed = JSON.parse(raw) as DealScoringModel;
          } catch {
            parsed = null;
          }
        }
        if (parsed && Array.isArray(parsed.factors) && parsed.factors.length) {
          setScoringModel({
            ...DEFAULT_DEAL_SCORING_MODEL,
            ...parsed,
            factors: parsed.factors.map((f, i) => ({
              code: String(f?.code || DEFAULT_DEAL_SCORING_MODEL.factors[i]?.code || `factor_${i}`),
              name: String(f?.name || DEFAULT_DEAL_SCORING_MODEL.factors[i]?.name || `Фактор ${i + 1}`),
              weight: Number(f?.weight ?? DEFAULT_DEAL_SCORING_MODEL.factors[i]?.weight ?? 0),
              enabled: Boolean(f?.enabled ?? true),
            })),
          });
        } else {
          setScoringModel(DEFAULT_DEAL_SCORING_MODEL);
        }
      } else {
        setScoringRecordId("");
        setScoringModel(DEFAULT_DEAL_SCORING_MODEL);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function save() {
    const payload = {
      type: "deal",
      base_text: prompt,
      variants: { purpose: "deal_analysis_prompt", source: "admin_parsers_ai_tab" },
      language: "ru",
      model: "deal_analysis_prompt",
    };
    if (dealPromptId) {
      await pb.collection("semantic_packs").update(dealPromptId, payload);
    } else {
      const created = await pb.collection("semantic_packs").create(payload);
      setDealPromptId((created as { id: string }).id);
    }
    const clientPayload = {
      type: "deal",
      base_text: clientPrompt,
      variants: { purpose: "client_research_prompt", source: "admin_ai_tab" },
      language: "ru",
      model: "client_research_prompt",
    };
    if (clientPromptId) await pb.collection("semantic_packs").update(clientPromptId, clientPayload);
    else {
      const created = await pb.collection("semantic_packs").create(clientPayload);
      setClientPromptId((created as { id: string }).id);
    }
    const tzPayload = {
      type: "deal",
      base_text: tzPrompt,
      variants: { purpose: "tz_analysis_prompt", source: "admin_ai_tab" },
      language: "ru",
      model: "tz_analysis_prompt",
    };
    if (tzPromptId) await pb.collection("semantic_packs").update(tzPromptId, tzPayload);
    else {
      const created = await pb.collection("semantic_packs").create(tzPayload);
      setTzPromptId((created as { id: string }).id);
    }
    const scoringPayload = {
      type: "deal_scoring_model",
      base_text: "Tenant scoring factors for deterministic deal probability",
      variants: scoringModel,
      language: "ru",
      model: "deal_scoring_model_v1",
    };
    if (scoringRecordId) {
      await pb.collection("semantic_packs").update(scoringRecordId, scoringPayload);
    } else {
      const createdScoring = await pb.collection("semantic_packs").create(scoringPayload);
      setScoringRecordId((createdScoring as { id: string }).id);
    }
    setStatus("Сохранено (промпт + факторы скоринга)");
    setTimeout(() => setStatus(""), 2500);
  }

  function updateFactor(idx: number, patch: Partial<DealScoringFactor>) {
    setScoringModel((prev) => ({
      ...prev,
      factors: prev.factors.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Настройка AI: промпты сценариев</div>
        <div className="text-xs text-text2 mt-1">
          Рекомендуется не менять без веской причины. Эти промпты используются как базовые сценарные инструкции.
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : (
          <div className="grid gap-3">
            <div className="rounded-card border border-infoBorder bg-infoBg p-3">
              <div className="text-sm font-semibold">Рекомендуемая модель скоринга (по умолчанию)</div>
              <div className="text-xs text-text2 mt-1">
                Мы предзаполнили факторную модель для всех клиентов. Рекомендуем использовать ее как baseline.
                При необходимости можно скорректировать веса и включение факторов под ваш процесс.
              </div>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setScoringModel({
                      ...DEFAULT_DEAL_SCORING_MODEL,
                      acknowledged: true,
                    })
                  }
                >
                  Вернуть рекомендуемую модель
                </Button>
              </div>
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Промпт: анализ сделки (рекомендуется не менять)</div>
              <textarea
                className="w-full rounded-card border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
                rows={8}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Опиши правила AI-анализа для этой CRM..."
              />
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Промпт: исследование клиента (рекомендуется не менять)</div>
              <textarea
                className="w-full rounded-card border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
                rows={6}
                value={clientPrompt}
                onChange={(e) => setClientPrompt(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Промпт: анализ ТЗ (рекомендуется не менять)</div>
              <textarea
                className="w-full rounded-card border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
                rows={6}
                value={tzPrompt}
                onChange={(e) => setTzPrompt(e.target.value)}
              />
            </div>
            <div className="rounded-card border border-border bg-rowHover p-3">
              <div className="text-sm font-semibold">Факторы скоринга вероятности сделки</div>
              <div className="text-xs text-text2 mt-1">
                Итоговая вероятность закрытия считается детерминированно по этим факторам (веса и включение можно менять).
              </div>
              <div className="mt-3 overflow-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                      <th className="text-left px-3">Фактор</th>
                      <th className="text-left px-3">Код</th>
                      <th className="text-left px-3">Вес</th>
                      <th className="text-left px-3">Включен</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoringModel.factors.map((f, idx) => (
                      <tr key={f.code} className="h-12 border-b border-border">
                        <td className="px-3">
                          <Input value={f.name} onChange={(e) => updateFactor(idx, { name: e.target.value })} />
                        </td>
                        <td className="px-3 text-text2">{f.code}</td>
                        <td className="px-3">
                          <Input
                            value={String(f.weight)}
                            onChange={(e) => updateFactor(idx, { weight: Number(e.target.value || 0) })}
                          />
                        </td>
                        <td className="px-3">
                          <input
                            type="checkbox"
                            checked={!!f.enabled}
                            onChange={(e) => updateFactor(idx, { enabled: e.target.checked })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={!prompt.trim() || !clientPrompt.trim() || !tzPrompt.trim()}>Сохранить промпты</Button>
              {status ? <span className="text-sm text-success">{status}</span> : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** KP SETTINGS (skeleton) */
function KpSettings() {
  const [tpl, setTpl] = React.useState<KpTemplateRecord | null>(null);

  async function ensureDefault() {
    const list = await pb
      .collection("settings_kp_templates")
      .getList(1, 1, { filter: "is_default=true && is_active=true" })
      .catch(() => ({ items: [] as KpTemplateRecord[] }));

    if (list.items[0]) return list.items[0];

    const created = await pb
      .collection("settings_kp_templates")
      .create({ name: DEFAULT_KP_TEMPLATE_V1.name, is_active: true, is_default: true, template_json: DEFAULT_KP_TEMPLATE_V1 })
      .catch(() => null);

    return created;
  }

  async function load() {
    const t = await ensureDefault();
    setTpl(t);
  }
  React.useEffect(() => { load(); }, []);

  async function save(patch: KpTemplatePatch) {
    if (!tpl?.id) return;
    await pb.collection("settings_kp_templates").update(tpl.id, patch);
  }

  return (
    <div className="grid gap-4">
      {!tpl ? (
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">КП (каркас)</div>
            <div className="text-xs text-text2 mt-1">Загрузка…</div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-text2">Проверь, что в PocketBase создана коллекция <code>settings_kp_templates</code> (см. JSON патч).</div>
          </CardContent>
        </Card>
      ) : (
        <>
          <KpTemplateEditor templateRecord={tpl} onSave={save} onReload={load} />
          <PriceListAdmin />
        </>
      )}
    </div>
  );
}
