import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";

type EntityType = "company" | "deal";
type FieldSection = { id: string; entity_type: EntityType; key: string; title: string; order?: number; collapsed?: boolean };
type FieldOptionMap = Record<string, unknown>;
type DynamicField = {
  id: string;
  entity_type: EntityType;
  collection: string;
  section_id?: string | null;
  field_name?: string;
  label: string;
  field_type: string;
  value_type?: string;
  required?: boolean;
  visible?: boolean;
  options?: FieldOptionMap;
  sort_order?: number;
  order?: number;
  system?: boolean;
  help_text?: string;
  role_visibility?: Record<string, unknown>;
};

type RelationCollectionOption = { value: string; label: string };

type RelationFieldOptions = {
  collection?: string;
  labelField?: string;
};

type SelectFieldOptions = {
  values?: string[];
};

const ENTITY_MAP: Record<EntityType, { label: string; collection: string }> = {
  company: { label: "Компании", collection: "companies" },
  deal: { label: "Сделки", collection: "deals" },
};

const FIELD_TYPES = [
  { v: "text", l: "Текст" },
  { v: "number", l: "Число" },
  { v: "date", l: "Дата" },
  { v: "email", l: "Email" },
  { v: "textarea", l: "Текст (многострочный)" },
  { v: "select", l: "Список" },
  { v: "relation", l: "Связь" },
] as const;

const DEFAULT_RELATION_COLLECTIONS: RelationCollectionOption[] = [
  { value: "companies", label: "companies — Компании" },
  { value: "deals", label: "deals — Сделки" },
  { value: "contacts", label: "contacts — Контакты" },
  { value: "users", label: "users — Пользователи" },
  { value: "tasks", label: "tasks — Задачи" },
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
    name = `${base || "field"}_${i}`.slice(0, 48);
    i += 1;
  }
  return name;
}

function parseFieldOptions(raw: unknown): FieldOptionMap {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as FieldOptionMap;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as FieldOptionMap;
  return {};
}

function parseSelectValues(input: string): string[] {
  return input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function stringifySelectValues(raw: unknown): string {
  const options = parseFieldOptions(raw) as SelectFieldOptions;
  return Array.isArray(options.values) ? options.values.join("\n") : "";
}

function getRelationOptions(raw: unknown): RelationFieldOptions {
  const options = parseFieldOptions(raw);
  return {
    collection: typeof options.collection === "string" ? options.collection : "",
    labelField: typeof options.labelField === "string" ? options.labelField : "name",
  };
}

function buildFieldOptions(fieldType: string, selectValuesText: string, relationCollection: string, relationLabelField: string): FieldOptionMap {
  if (fieldType === "select") {
    return { values: parseSelectValues(selectValuesText) };
  }
  if (fieldType === "relation") {
    return {
      collection: relationCollection.trim(),
      labelField: relationLabelField.trim() || "name",
    };
  }
  return {};
}

function inferValueType(fieldType: string): string {
  if (fieldType === "number") return "number";
  if (fieldType === "date") return "date";
  if (fieldType === "relation") return "text";
  if (fieldType === "select") return "text";
  return "text";
}

function FieldOptionsEditor(props: {
  fieldType: string;
  selectValuesText: string;
  relationCollection: string;
  relationLabelField: string;
  relationCollections: RelationCollectionOption[];
  onSelectValuesTextChange: (value: string) => void;
  onRelationCollectionChange: (value: string) => void;
  onRelationLabelFieldChange: (value: string) => void;
}) {
  const {
    fieldType,
    selectValuesText,
    relationCollection,
    relationLabelField,
    relationCollections,
    onSelectValuesTextChange,
    onRelationCollectionChange,
    onRelationLabelFieldChange,
  } = props;

  if (fieldType === "select") {
    return (
      <div className="col-span-12">
        <div className="text-xs text-text2 mb-1">Варианты списка</div>
        <textarea
          className="ui-input min-h-[96px] w-full resize-y py-2"
          value={selectValuesText}
          onChange={(e) => onSelectValuesTextChange(e.target.value)}
          placeholder={"Каждое значение с новой строки\nВходящий\nПартнёр\nПовторная продажа"}
        />
      </div>
    );
  }

  if (fieldType === "relation") {
    return (
      <>
        <div className="col-span-6">
          <div className="text-xs text-text2 mb-1">Коллекция связи</div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-7">
              <select
                className="ui-input h-10 w-full"
                value={relationCollection}
                onChange={(e) => onRelationCollectionChange(e.target.value)}
              >
                <option value="">— выбрать —</option>
                {relationCollections.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-5">
              <Input
                value={relationCollection}
                onChange={(e) => onRelationCollectionChange(e.target.value)}
                placeholder="или вручную"
              />
            </div>
          </div>
        </div>
        <div className="col-span-6">
          <div className="text-xs text-text2 mb-1">Поле для подписи</div>
          <Input
            value={relationLabelField}
            onChange={(e) => onRelationLabelFieldChange(e.target.value)}
            placeholder="name / title / email"
          />
        </div>
      </>
    );
  }

  return null;
}

export function AdminFieldsPage() {
  const [entity, setEntity] = React.useState<EntityType>("company");
  const [sections, setSections] = React.useState<FieldSection[]>([]);
  const [fields, setFields] = React.useState<DynamicField[]>([]);
  const [relationCollections, setRelationCollections] = React.useState<RelationCollectionOption[]>(DEFAULT_RELATION_COLLECTIONS);

  const [sectionTitle, setSectionTitle] = React.useState("");

  const [sectionId, setSectionId] = React.useState<string>("");
  const [label, setLabel] = React.useState("");
  const [fieldType, setFieldType] = React.useState("text");
  const [required, setRequired] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [selectValuesText, setSelectValuesText] = React.useState("");
  const [relationCollection, setRelationCollection] = React.useState("");
  const [relationLabelField, setRelationLabelField] = React.useState("name");

  async function load() {
    const filter = `entity_type="${entity}"`;
    const [sec, flds] = await Promise.all([
      pb.collection("settings_field_sections").getFullList({ filter, sort: "order" }).catch(() => []),
      pb.collection("settings_fields").getFullList({ filter, sort: "order,sort_order" }).catch(() => []),
    ]);

    setSections(sec as FieldSection[]);
    setFields(flds as DynamicField[]);

    if (!sectionId) {
      const first = (sec as FieldSection[])[0]?.id;
      if (first) setSectionId(first);
    }

    try {
      const collections = await pb.collections.getFullList();
      const dynamicOptions: RelationCollectionOption[] = collections
        .map((item) => ({
          value: String(item.name || "").trim(),
          label: `${String(item.name || "").trim()}${item.type ? ` — ${item.type}` : ""}`,
        }))
        .filter((item) => item.value);
      const merged = [...DEFAULT_RELATION_COLLECTIONS, ...dynamicOptions].reduce<RelationCollectionOption[]>((acc, item) => {
        if (!acc.some((existing) => existing.value === item.value)) acc.push(item);
        return acc;
      }, []);
      setRelationCollections(merged);
    } catch {
      setRelationCollections(DEFAULT_RELATION_COLLECTIONS);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  function resetFieldBuilder() {
    setLabel("");
    setFieldType("text");
    setRequired(false);
    setVisible(true);
    setSelectValuesText("");
    setRelationCollection("");
    setRelationLabelField("name");
  }

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
    await load();
  }

  async function updateSection(id: string, data: Partial<FieldSection>) {
    await pb.collection("settings_field_sections").update(id, data);
    await load();
  }

  async function deleteSection(id: string) {
    const has = fields.some((f) => f.section_id === id);
    if (has) {
      alert("Нельзя удалить раздел: в нём есть поля. Сначала перенесите/удалите поля.");
      return;
    }
    await pb.collection("settings_field_sections").delete(id);
    if (sectionId === id) setSectionId("");
    await load();
  }

  async function addField() {
    const collection = ENTITY_MAP[entity].collection;
    const sort_order = fields.filter((x) => x.section_id === sectionId).length + 1;

    const existing = fields
      .filter((f) => f.entity_type === entity)
      .map((f) => String(f.field_name || ""))
      .filter(Boolean);
    const autoFieldName = makeFieldName(label, existing);
    const options = buildFieldOptions(fieldType, selectValuesText, relationCollection, relationLabelField);

    if (fieldType === "select" && parseSelectValues(selectValuesText).length === 0) {
      alert("Для поля типа 'Список' нужно указать хотя бы один вариант.");
      return;
    }

    if (fieldType === "relation" && !relationCollection.trim()) {
      alert("Для поля типа 'Связь' нужно указать коллекцию PocketBase.");
      return;
    }

    await pb.collection("settings_fields").create({
      entity_type: entity,
      collection,
      section_id: sectionId || null,
      field_name: autoFieldName,
      label: label.trim(),
      field_type: fieldType,
      value_type: inferValueType(fieldType),
      required,
      visible,
      options,
      sort_order,
      order: sort_order,
      system: false,
      help_text: "",
      role_visibility: {},
    });

    resetFieldBuilder();
    await load();
  }

  async function updateField(id: string, data: Partial<DynamicField>) {
    await pb.collection("settings_fields").update(id, data);
    await load();
  }

  async function updateFieldOptions(id: string, fieldTypeValue: string, rawOptions: unknown) {
    const selectText = stringifySelectValues(rawOptions);
    const relation = getRelationOptions(rawOptions);
    const options = buildFieldOptions(fieldTypeValue, selectText, relation.collection || "", relation.labelField || "name");
    await updateField(id, {
      field_type: fieldTypeValue,
      value_type: inferValueType(fieldTypeValue),
      options,
    });
  }

  async function deleteField(id: string) {
    await pb.collection("settings_fields").delete(id);
    await load();
  }

  const filteredFields = fields
    .slice()
    .sort((a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0));

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Конструктор полей и разделов</div>
        <div className="text-xs text-text2 mt-1">
          Управляет карточками сделок/компаний: разделы, порядок, типы и настройки сложных полей.
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
                      <Input value={s.title} onChange={(e) => void updateSection(s.id, { title: e.target.value })} />
                    </td>
                    <td className="px-3">
                      <Input value={String(s.order ?? 0)} onChange={(e) => void updateSection(s.id, { order: Number(e.target.value || 0) })} />
                    </td>
                    <td className="px-3 text-right">
                      <Button variant="danger" small onClick={() => void deleteSection(s.id)}>
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

              <FieldOptionsEditor
                fieldType={fieldType}
                selectValuesText={selectValuesText}
                relationCollection={relationCollection}
                relationLabelField={relationLabelField}
                relationCollections={relationCollections}
                onSelectValuesTextChange={setSelectValuesText}
                onRelationCollectionChange={setRelationCollection}
                onRelationLabelFieldChange={setRelationLabelField}
              />
            </div>
          </div>

          <div className="overflow-auto rounded-card border border-border bg-card">
            <div className="px-3 py-2 border-b border-border bg-rowHover text-text1 font-semibold text-sm">
              Поля ({filteredFields.length})
            </div>
            <table className="min-w-[1500px] w-full text-sm">
              <thead>
                <tr className="h-10 text-text1 font-semibold">
                  <th className="text-left px-3">Раздел</th>
                  <th className="text-left px-3">Название</th>
                  <th className="text-left px-3">Тип</th>
                  <th className="text-left px-3">Настройки типа</th>
                  <th className="text-left px-3 w-[120px]">Порядок</th>
                  <th className="text-left px-3 w-[120px]">Обяз.</th>
                  <th className="text-left px-3 w-[120px]">Видимо</th>
                  <th className="text-right px-3 w-[140px]">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.map((f) => {
                  const relation = getRelationOptions(f.options);
                  const selectText = stringifySelectValues(f.options);
                  return (
                    <tr key={f.id} className="border-t border-border align-top">
                      <td className="px-3 py-2">
                        <select
                          className="ui-input h-9"
                          value={f.section_id || ""}
                          onChange={(e) => void updateField(f.id, { section_id: e.target.value || null })}
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
                      <td className="px-3 py-2">
                        <Input value={f.label} onChange={(e) => void updateField(f.id, { label: e.target.value })} />
                        <div className="text-[11px] text-text2 mt-1">{f.field_name || "—"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="ui-input h-9"
                          value={f.field_type}
                          onChange={(e) => void updateFieldOptions(f.id, e.target.value, f.options)}
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.v} value={t.v}>
                              {t.l}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 min-w-[360px]">
                        {f.field_type === "select" ? (
                          <textarea
                            className="ui-input min-h-[88px] w-full resize-y py-2"
                            defaultValue={selectText}
                            placeholder="Значения списка, каждое с новой строки"
                            onBlur={(e) => void updateField(f.id, { options: { values: parseSelectValues(e.target.value) } })}
                          />
                        ) : f.field_type === "relation" ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[11px] text-text2 mb-1">Коллекция</div>
                              <Input
                                defaultValue={relation.collection || ""}
                                placeholder="companies"
                                onBlur={(e) =>
                                  void updateField(f.id, {
                                    options: {
                                      collection: e.target.value.trim(),
                                      labelField: relation.labelField || "name",
                                    },
                                  })
                                }
                              />
                            </div>
                            <div>
                              <div className="text-[11px] text-text2 mb-1">Поле подписи</div>
                              <Input
                                defaultValue={relation.labelField || "name"}
                                placeholder="name"
                                onBlur={(e) =>
                                  void updateField(f.id, {
                                    options: {
                                      collection: relation.collection || "",
                                      labelField: e.target.value.trim() || "name",
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-text2 py-2">Для этого типа доп. настройка не нужна.</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={String(f.order ?? f.sort_order ?? 0)}
                          onChange={(e) => void updateField(f.id, { order: Number(e.target.value || 0), sort_order: Number(e.target.value || 0) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={!!f.required} onChange={(e) => void updateField(f.id, { required: e.target.checked })} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={!!f.visible} onChange={(e) => void updateField(f.id, { visible: e.target.checked })} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="danger" small onClick={() => void deleteField(f.id)}>
                          Удалить
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredFields.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-sm text-text2">
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
