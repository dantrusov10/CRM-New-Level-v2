import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";
import { KpTemplateEditor } from "../../modules/kp/KpTemplateEditor";
import { DEFAULT_KP_TEMPLATE_V1 } from "../../modules/kp/defaultTemplate";

type Tab = "contacts" | "media" | "tenders" | "kp";

export function AdminParsersPage() {
  const [tab, setTab] = React.useState<Tab>("contacts");

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Парсеры и AI-настройки</div>
          <div className="text-xs text-text2 mt-1">Контакты (карта ролей), медиа (источники + ключевые слова), тендеры (площадки + токены) + каркас КП</div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <TabButton active={tab==="contacts"} onClick={() => setTab("contacts")}>Контакты</TabButton>
            <TabButton active={tab==="media"} onClick={() => setTab("media")}>Медиа</TabButton>
            <TabButton active={tab==="tenders"} onClick={() => setTab("tenders")}>Тендеры</TabButton>
            <TabButton active={tab==="kp"} onClick={() => setTab("kp")}>КП (каркас)</TabButton>
          </div>
        </CardContent>
      </Card>

      {tab === "contacts" ? <ContactsParser /> : null}
      {tab === "media" ? <MediaParser /> : null}
      {tab === "tenders" ? <TenderParser /> : null}
      {tab === "kp" ? <KpSettings /> : null}
    </div>
  );
}

function TabButton({ active, children, onClick }: any) {
  return (
    <button
      className={
        "h-10 rounded-card px-4 text-sm border " +
        (active ? "bg-rowSelected border-border" : "bg-white border-border hover:bg-rowHover")
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** CONTACTS */
function ContactsParser() {
  const [settings, setSettings] = React.useState<any>(null);
  const [maps, setMaps] = React.useState<any[]>([]);
  const [items, setItems] = React.useState<any[]>([]);
  const [title, setTitle] = React.useState("");
  const [segment, setSegment] = React.useState("default");
  const [currentMap, setCurrentMap] = React.useState<string>("");

  const [pos, setPos] = React.useState("");
  const [influence, setInfluence] = React.useState("lpr");
  const [weight, setWeight] = React.useState("1");

  async function load() {
    const sList = await pb.collection("settings_contact_parser").getList(1, 1).catch(() => ({ items: [] as any[] }));
    const s = sList.items[0] ?? (await pb.collection("settings_contact_parser").create({ enabled: true, schedule_cron: "0 9 * * *", sources_policy: "official_only" }));
    setSettings(s);

    const m = await pb.collection("role_maps").getFullList({ sort: "-created" });
    setMaps(m as any);

    const mapId = (s as any).role_map_id ?? (m[0] as any)?.id ?? "";
    setCurrentMap(mapId);
    if (mapId) {
      const it = await pb.collection("role_map_items").getFullList({ filter: `role_map_id="${mapId}"`, sort: "-is_active, -weight, position_title" });
      setItems(it as any);
    } else {
      setItems([]);
    }
  }

  React.useEffect(() => { load(); }, []);

  async function saveSettings(patch: any) {
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
  const [settings, setSettings] = React.useState<any>(null);
  const [sources, setSources] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [keywords, setKeywords] = React.useState("");

  async function load() {
    const sList = await pb.collection("settings_media_parser").getList(1, 1).catch(() => ({ items: [] as any[] }));
    const s = sList.items[0] ?? (await pb.collection("settings_media_parser").create({ enabled: true, schedule_cron: "0 9 * * *", keywords: { phrases: [] } }));
    setSettings(s);

    const src = await pb.collection("parser_sources_media").getFullList({ filter: "is_active=true", sort: "name" });
    setSources(src as any);

    const links = await pb.collection("settings_media_parser_sources").getFullList({ filter: `settings_id="${s.id}"` }).catch(() => []);
    setSelected(new Set((links as any[]).map((l) => l.source_id)));
    setKeywords(((s.keywords?.phrases ?? []) as any[]).join(", "));
  }

  React.useEffect(() => { load(); }, []);

  async function saveSettings(patch: any) {
    const upd = await pb.collection("settings_media_parser").update(settings.id, patch);
    setSettings(upd);
  }

  async function toggleSource(id: string, on: boolean) {
    if (on) {
      await pb.collection("settings_media_parser_sources").create({ settings_id: settings.id, source_id: id });
    } else {
      const rec = await pb.collection("settings_media_parser_sources").getFirstListItem(`settings_id="${settings.id}" && source_id="${id}"`).catch(() => null);
      if (rec) await pb.collection("settings_media_parser_sources").delete((rec as any).id);
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
  const [settings, setSettings] = React.useState<any>(null);
  const [platforms, setPlatforms] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [keywords, setKeywords] = React.useState("");
  const [tokens, setTokens] = React.useState("");

  async function load() {
    const sList = await pb.collection("settings_tender_parser").getList(1, 1).catch(() => ({ items: [] as any[] }));
    const s = sList.items[0] ?? (await pb.collection("settings_tender_parser").create({ enabled: true, schedule_cron: "0 9 * * *", keywords: { phrases: [] }, platform_tokens: {} }));
    setSettings(s);

    const p = await pb.collection("parser_sources_tender").getFullList({ filter: "is_active=true", sort: "name" });
    setPlatforms(p as any);

    const links = await pb.collection("settings_tender_parser_platforms").getFullList({ filter: `settings_id="${s.id}"` }).catch(() => []);
    setSelected(new Set((links as any[]).map((l) => l.platform_id)));
    setKeywords(((s.keywords?.phrases ?? []) as any[]).join(", "));
    setTokens(JSON.stringify(s.platform_tokens ?? {}, null, 2));
  }

  React.useEffect(() => { load(); }, []);

  async function saveSettings(patch: any) {
    const upd = await pb.collection("settings_tender_parser").update(settings.id, patch);
    setSettings(upd);
  }

  async function togglePlatform(id: string, on: boolean) {
    if (on) {
      await pb.collection("settings_tender_parser_platforms").create({ settings_id: settings.id, platform_id: id });
    } else {
      const rec = await pb.collection("settings_tender_parser_platforms").getFirstListItem(`settings_id="${settings.id}" && platform_id="${id}"`).catch(() => null);
      if (rec) await pb.collection("settings_tender_parser_platforms").delete((rec as any).id);
    }
    load();
  }

  async function saveKeywords() {
    const phrases = keywords.split(",").map((s) => s.trim()).filter(Boolean);
    await saveSettings({ keywords: { phrases } });
  }

  async function saveTokens() {
    const obj = JSON.parse(tokens || "{}");
    await saveSettings({ platform_tokens: obj });
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
              <div className="text-sm font-semibold mb-2">Токены доступа (JSON)</div>
              <textarea className="w-full min-h-[160px] rounded-card border border-[#9CA3AF] bg-white p-3 font-mono text-xs" value={tokens} onChange={(e) => setTokens(e.target.value)} />
              <div className="flex justify-end mt-2">
                <Button onClick={saveTokens}>Сохранить</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** KP SETTINGS (skeleton) */
function KpSettings() {
  const [tpl, setTpl] = React.useState<any>(null);

  async function ensureDefault() {
    const list = await pb
      .collection("settings_kp_templates")
      .getList(1, 1, { filter: "is_default=true && is_active=true" })
      .catch(() => ({ items: [] as any[] }));

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

  async function save(patch: any) {
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
        <KpTemplateEditor templateRecord={tpl} onSave={save} onReload={load} />
      )}
    </div>
  );
}
