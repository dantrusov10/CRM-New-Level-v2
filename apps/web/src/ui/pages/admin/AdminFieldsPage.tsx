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
  // MVP: оставляем только базовые типы. Options/relations будут управляться автоматически на бэке позже.
  { v: "textarea", l: "Текст (многострочный)" },
];

function translitRuToEn(input: string) {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return input
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
}

function makeFieldName(label: string, existing: string[]) {
  const base = translitRuToEn(label)
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42);

  let name = base || `field_${Date.now()}`;
  if (!/^[a-z_]/.test(name)) name = `f_${name}`;

  let i = 2;
  while (existing.includes(name)) {
    name = `${(base || "field")}_${i}`.slice(0, 48);
    i += 1;
  }
  return name;
}

export function AdminFieldsPage() {
  const [entity, setEntity] = React.useState<EntityType>("company");
  const [sections, setSections] = React.useState<any[]>([]);
  const [fields, setFields] = React.useState<any[]>([]);

  // sections form
  const [sectionTitle, setSectionTitle] = React.useState("");

  // fields form
  const [sectionId, setSectionId] = React.useState<string>("");
  const [label, setLabel] = React.useState("");
  const [fieldType, setFieldType] = React.useState("text");
  const [required, setRequired] = React.useState(false);
  const [visible, setVisible] = React.useState(true);

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

    const existing = fields
      .filter((f) => f.entity_type === entity)
      .map((f) => String(f.field_name || ""))
      .filter(Boolean);
    const autoFieldName = makeFieldName(label, existing);

    // options скрыты из UI: на MVP держим пустыми (не показываем пользователю JSON)
    const optObj: any = {};

    await pb.collection("settings_fields").create({
      entity_type: entity,
      collection,
      section_id: sectionId || null,
      field_name: autoFieldName,
      label: label.trim(),
      field_type: fieldType,
      value_type: fieldType === "number" ? "number" : fieldType === "date" ? "date" : "text",
      required,
      visible,
      options: optObj,
      sort_order,
      order: sort_order,
      system: false,
      help_text: "",
      role_visibility: {},
    });
    setLabel("");
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
                  className="ui-input h-10 w-full"
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
          <div className="rounded-card border border-border bg-card overflow-auto">
            <div className="px-3 py-2 border-b border-border bg-rowHover text-text1 font-semibold text-sm">
              Разделы ({sections.length})
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="h-10 text-text1 font-semibold">
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
                  className="ui-input h-10 w-full"
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
                <div className="text-xs text-text2 mb-1">Название (label)</div>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Канал продаж" />
              </div>
              <div className="col-span-3">
                <div className="text-xs text-text2 mb-1">Тип</div>
                <select
                  className="ui-input h-10 w-full"
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
                  <div className="col-span-10 flex items-center gap-4">
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
                    <Button onClick={addField} disabled={!label.trim()}>
                      + Поле
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fields table */}
          <div className="overflow-auto rounded-card border border-border bg-card">
            <div className="px-3 py-2 border-b border-border bg-rowHover text-text1 font-semibold text-sm">
              Поля ({filteredFields.length})
            </div>
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="h-10 text-text1 font-semibold">
                  <th className="text-left px-3">Раздел</th>
                  <th className="text-left px-3">Название</th>
                  <th className="text-left px-3">Тип</th>
                  <th className="text-left px-3 w-[120px]">Порядок</th>
                  <th className="text-left px-3 w-[120px]">Обяз.</th>
                  <th className="text-left px-3 w-[120px]">Видимо</th>
                  <th className="text-right px-3 w-[140px]">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.map((f) => (
                  <tr key={f.id} className="h-11 border-t border-border">
                    <td className="px-3">
                      <select
                        className="ui-input h-9"
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
                    <td className="px-3">
                      <Input value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} />
                    </td>
                    <td className="px-3">
                      <select
                        className="ui-input h-9"
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
                    <td className="px-3 text-right">
                      <Button variant="danger" small onClick={() => deleteField(f.id)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filteredFields.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-sm text-text2">
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
