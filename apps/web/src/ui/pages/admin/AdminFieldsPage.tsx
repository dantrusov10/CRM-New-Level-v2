import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";

type EntityType = "company" | "deal";

const ENTITY_MAP: Record<EntityType, { label: string; collection: string }> = {
  company: { label: "Компании", collection: "companies" },
  deal: { label: "Сделки", collection: "deals" },
};

const FIELD_TYPES = [
  { v: "text", l: "Текст" },
  { v: "number", l: "Число" },
  { v: "date", l: "Дата" },
  { v: "email", l: "Email" },
  { v: "select", l: "Выбор из списка" },
  { v: "relation", l: "Связь (relation)" },
  { v: "json", l: "JSON" },
];

function parseOptions(raw: any): any {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

export function AdminFieldsPage() {
  const [entity, setEntity] = React.useState<EntityType>("company");
  const [sections, setSections] = React.useState<any[]>([]);
  const [fields, setFields] = React.useState<any[]>([]);

  // sections form
  const [sectionTitle, setSectionTitle] = React.useState("");

  // fields form
  const [sectionId, setSectionId] = React.useState<string>("");
  const [fieldName, setFieldName] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [fieldType, setFieldType] = React.useState("text");
  const [required, setRequired] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [options, setOptions] = React.useState("");

  async function load() {
    const filter = `entity_type="${entity}"`;
    const [sec, flds] = await Promise.all([
      pb.collection("settings_field_sections").getFullList({ filter, sort: "order" }).catch(() => []),
      pb.collection("settings_fields").getFullList({ filter, sort: "order,sort_order" }).catch(() => []),
    ]);
    setSections(sec as any);
    setFields(flds as any);
    if (!sectionId) {
      const first = (sec as any[])[0]?.id;
      if (first) setSectionId(first);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  async function addSection() {
    const order = (sections?.length ?? 0) + 1;
    const key = sectionTitle
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_\-]/g, "")
      .slice(0, 48) || `section_${Date.now()}`;
    const created = await pb.collection("settings_field_sections").create({
      entity_type: entity,
      key,
      title: sectionTitle.trim(),
      order,
      collapsed: false,
    });
    setSectionTitle("");
    setSectionId(created.id);
    load();
  }

  async function updateSection(id: string, data: any) {
    await pb.collection("settings_field_sections").update(id, data);
    load();
  }

  async function deleteSection(id: string) {
    // soft guard: if section has fields -> keep behavior predictable
    const has = fields.some((f) => f.section_id === id);
    if (has) {
      alert("Нельзя удалить раздел: в нём есть поля. Сначала перенесите/удалите поля.");
      return;
    }
    await pb.collection("settings_field_sections").delete(id);
    if (sectionId === id) setSectionId("");
    load();
  }

  async function addField() {
    const collection = ENTITY_MAP[entity].collection;
    const sort_order = fields.filter((x) => x.section_id === sectionId).length + 1;

    let optObj: any = {};
    if (fieldType === "select") {
      const values = options
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      optObj = { values };
    } else if (fieldType === "relation") {
      // Expected format: collection=companies;label=name  OR just collection name
      const o = options.trim();
      if (o.includes("{") && o.includes("}")) {
        optObj = parseOptions(o);
      } else if (o.includes("collection=")) {
        const parts = Object.fromEntries(
          o
            .split(";")
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => {
              const [k, v] = p.split("=");
              return [k.trim(), (v || "").trim()];
            })
        );
        optObj = { collection: parts.collection || "", labelField: parts.label || "name" };
      } else {
        optObj = { collection: o, labelField: "name" };
      }
    } else if (fieldType === "json") {
      optObj = {};
    }

    await pb.collection("settings_fields").create({
      entity_type: entity,
      collection,
      section_id: sectionId || null,
      field_name: fieldName.trim(),
      label: label.trim(),
      field_type: fieldType,
      value_type: fieldType === "number" ? "number" : fieldType === "date" ? "date" : fieldType === "json" ? "json" : "text",
      required,
      visible,
      options: optObj,
      sort_order,
      order: sort_order,
      system: false,
      help_text: "",
      role_visibility: {},
    });
    setFieldName("");
    setLabel("");
    setOptions("");
    load();
  }

  async function updateField(id: string, data: any) {
    await pb.collection("settings_fields").update(id, data);
    load();
  }

  async function deleteField(id: string) {
    await pb.collection("settings_fields").delete(id);
    load();
  }

  const filteredFields = fields
    .slice()
    .sort((a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0));

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Конструктор полей и разделов</div>
        <div className="text-xs text-text2 mt-1">
          Полностью управляет карточками сделок/компаний: разделы + поля + порядок + типы.
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="rounded-card border border-border bg-rowHover p-3">
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <div className="text-xs text-text2 mb-1">Сущность</div>
                <select
                  className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value as EntityType)}
                >
                  <option value="company">Компании</option>
                  <option value="deal">Сделки</option>
                </select>
              </div>

              <div className="col-span-6">
                <div className="text-xs text-text2 mb-1">Добавить раздел</div>
                <div className="flex gap-2">
                  <Input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="Напр. Финансы" />
                  <Button onClick={addSection} disabled={!sectionTitle.trim()}>
                    + Раздел
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sections list */}
          <div className="rounded-card border border-border bg-white overflow-auto">
            <div className="px-3 py-2 border-b border-border bg-[#EEF1F6] text-[#374151] font-semibold text-sm">
              Разделы ({sections.length})
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="h-10 text-[#374151] font-semibold">
                  <th className="text-left px-3">Название</th>
                  <th className="text-left px-3 w-[120px]">Порядок</th>
                  <th className="text-right px-3 w-[160px]">Действия</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => (
                  <tr key={s.id} className="h-11 border-t border-border">
                    <td className="px-3">
                      <Input value={s.title} onChange={(e) => updateSection(s.id, { title: e.target.value })} />
                    </td>
                    <td className="px-3">
                      <Input value={String(s.order ?? 0)} onChange={(e) => updateSection(s.id, { order: Number(e.target.value || 0) })} />
                    </td>
                    <td className="px-3 text-right">
                      <Button variant="danger" small onClick={() => deleteSection(s.id)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
                {!sections.length ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-sm text-text2">
                      Разделов пока нет. Добавь первый раздел.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Add field */}
          <div className="rounded-card border border-border bg-rowHover p-3">
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <div className="text-xs text-text2 mb-1">Раздел</div>
                <select
                  className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                >
                  <option value="">—</option>
                  {sections
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </div>
              <div className="col-span-3">
                <div className="text-xs text-text2 mb-1">Имя поля (field_name)</div>
                <Input value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="sales_channel_id" />
              </div>
              <div className="col-span-3">
                <div className="text-xs text-text2 mb-1">Название (label)</div>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Канал продаж" />
              </div>
              <div className="col-span-3">
                <div className="text-xs text-text2 mb-1">Тип</div>
                <select
                  className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-12">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <div className="text-xs text-text2 mb-1">
                      Опции
                      {fieldType === "select" ? " (для select: значения через запятую)" : ""}
                      {fieldType === "relation" ? " (для relation: collection=sales_channels;label=name)" : ""}
                    </div>
                    <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder={fieldType === "relation" ? "collection=companies;label=name" : "FinTech, Retail"} />
                  </div>
                  <div className="col-span-4 flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
                      Обязательное
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                      Видимое
                    </label>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button onClick={addField} disabled={!fieldName.trim() || !label.trim()}>
                      + Поле
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fields table */}
          <div className="overflow-auto rounded-card border border-border bg-white">
            <div className="px-3 py-2 border-b border-border bg-[#EEF1F6] text-[#374151] font-semibold text-sm">
              Поля ({filteredFields.length})
            </div>
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="h-10 text-[#374151] font-semibold">
                  <th className="text-left px-3">Раздел</th>
                  <th className="text-left px-3">field_name</th>
                  <th className="text-left px-3">label</th>
                  <th className="text-left px-3">type</th>
                  <th className="text-left px-3 w-[120px]">order</th>
                  <th className="text-left px-3 w-[70px]">req</th>
                  <th className="text-left px-3 w-[80px]">vis</th>
                  <th className="text-left px-3">options</th>
                  <th className="text-right px-3 w-[140px]">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.map((f) => (
                  <tr key={f.id} className="h-11 border-t border-border">
                    <td className="px-3">
                      <select
                        className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm"
                        value={f.section_id || ""}
                        onChange={(e) => updateField(f.id, { section_id: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {sections
                          .slice()
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-3 font-mono text-xs">{f.field_name}</td>
                    <td className="px-3">
                      <Input value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} />
                    </td>
                    <td className="px-3">
                      <select
                        className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm"
                        value={f.field_type}
                        onChange={(e) => updateField(f.id, { field_type: e.target.value })}
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.v} value={t.v}>
                            {t.l}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3">
                      <Input
                        value={String(f.order ?? f.sort_order ?? 0)}
                        onChange={(e) => updateField(f.id, { order: Number(e.target.value || 0), sort_order: Number(e.target.value || 0) })}
                      />
                    </td>
                    <td className="px-3">
                      <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} />
                    </td>
                    <td className="px-3">
                      <input type="checkbox" checked={!!f.visible} onChange={(e) => updateField(f.id, { visible: e.target.checked })} />
                    </td>
                    <td className="px-3">
                      <Input
                        value={typeof f.options === "string" ? f.options : JSON.stringify(f.options || {})}
                        onChange={(e) => {
                          const v = e.target.value;
                          let obj: any = v;
                          try {
                            obj = JSON.parse(v);
                          } catch {
                            // keep string
                          }
                          updateField(f.id, { options: obj });
                        }}
                      />
                    </td>
                    <td className="px-3 text-right">
                      <Button variant="danger" small onClick={() => deleteField(f.id)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filteredFields.length ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-sm text-text2">
                      Поля пока не настроены.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
