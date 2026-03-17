import React from "react";
import { pb } from "../../lib/pb";
import { Input } from "./Input";
import { Button } from "./Button";

type EntityType = "company" | "deal";

type SettingsField = {
  id: string;
  collection?: string;
  field_name: string;
  label: string;
  field_type: string;
  value_type?: string;
  required?: boolean;
  visible?: boolean;
  options?: any;
  section_id?: string;
  order?: number;
  sort_order?: number;
  system?: boolean;
  help_text?: string;
};

type SettingsSection = {
  id: string;
  entity_type: EntityType;
  key: string;
  title: string;
  order?: number;
  collapsed?: boolean;
};

type FieldValueRow = {
  id: string;
  field_id: string;
  value_text?: string;
  value_number?: number;
  value_date?: string;
  value_json?: any;
};

export type DynamicEntityFormHandle = {
  save: () => Promise<void>;
};

function parseOptions(raw: any): { values?: string[]; collection?: string; labelField?: string } {
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

function inferValueType(f: SettingsField) {
  const vt = (f.value_type || "").toString();
  if (vt) return vt;
  const t = (f.field_type || "text").toString();
  if (t === "number") return "number";
  if (t === "date") return "date";
  if (t === "json") return "json";
  return "text";
}

function getDefaultConfig(entity: EntityType, collectionName: string) {
  type DefaultSection = { key: string; title: string; order: number; collapsed?: boolean };
  type DefaultField = Partial<SettingsField> & { sectionKey: string; order: number; sort_order: number };

  const defaultsCompany: { sections: DefaultSection[]; fields: DefaultField[] } = {
    sections: [
      { key: "main", title: "Основное", order: 1 },
      { key: "contacts", title: "Контакты", order: 2, collapsed: true },
      { key: "other", title: "Дополнительно", order: 3, collapsed: true },
    ],
    fields: [
      { sectionKey: "main", order: 1, sort_order: 1, field_name: "name", label: "Название", field_type: "text", required: true },
      { sectionKey: "main", order: 1, sort_order: 2, field_name: "inn", label: "ИНН", field_type: "text" },
      { sectionKey: "main", order: 1, sort_order: 3, field_name: "city", label: "Город", field_type: "text" },
      { sectionKey: "main", order: 1, sort_order: 4, field_name: "website", label: "Сайт", field_type: "text" },
      { sectionKey: "main", order: 1, sort_order: 5, field_name: "sales_channel_id", label: "Канал продаж", field_type: "relation", options: { collection: "sales_channels", labelField: "name" } },
      { sectionKey: "contacts", order: 2, sort_order: 1, field_name: "email", label: "Email", field_type: "text" },
      { sectionKey: "contacts", order: 2, sort_order: 2, field_name: "phone", label: "Телефон", field_type: "text" },
      { sectionKey: "other", order: 3, sort_order: 1, field_name: "notes", label: "Заметки", field_type: "text" },
    ],
  };

  const defaultsDeal: { sections: DefaultSection[]; fields: DefaultField[] } = {
    sections: [
      { key: "main", title: "Основное", order: 1 },
      { key: "finance", title: "Финансы", order: 2 },
      { key: "project", title: "Проектные параметры", order: 3, collapsed: true },
      { key: "dates", title: "Даты", order: 4, collapsed: true },
      { key: "links", title: "Ссылки", order: 5, collapsed: true },
    ],
    fields: [
      { sectionKey: "main", order: 1, sort_order: 1, field_name: "title", label: "Название сделки", field_type: "text", required: true },
      { sectionKey: "main", order: 1, sort_order: 2, field_name: "company_id", label: "Компания", field_type: "relation", options: { collection: "companies", labelField: "name" } },
      { sectionKey: "main", order: 1, sort_order: 3, field_name: "sales_channel", label: "Канал продаж", field_type: "select", options: { values: ["прямой", "партнёр"] } },
      { sectionKey: "main", order: 1, sort_order: 4, field_name: "partner", label: "Партнёр", field_type: "text" },
      { sectionKey: "main", order: 1, sort_order: 5, field_name: "distributor", label: "Дистрибьютор", field_type: "text" },
      { sectionKey: "main", order: 1, sort_order: 6, field_name: "purchase_format", label: "Формат закупки", field_type: "text" },
      { sectionKey: "main", order: 1, sort_order: 7, field_name: "activity_type", label: "Тип активности", field_type: "text" },
      { sectionKey: "finance", order: 2, sort_order: 1, field_name: "budget", label: "Бюджет, ₽", field_type: "number" },
      { sectionKey: "finance", order: 2, sort_order: 2, field_name: "turnover", label: "Оборот, ₽", field_type: "number" },
      { sectionKey: "finance", order: 2, sort_order: 3, field_name: "margin_percent", label: "Маржа, %", field_type: "number" },
      { sectionKey: "finance", order: 2, sort_order: 4, field_name: "discount_percent", label: "Скидка, %", field_type: "number" },
      { sectionKey: "project", order: 3, sort_order: 1, field_name: "infrastructure_size", label: "Инфраструктура", field_type: "text" },
      { sectionKey: "project", order: 3, sort_order: 2, field_name: "endpoints", label: "Endpoints", field_type: "number" },
      { sectionKey: "project", order: 3, sort_order: 3, field_name: "presale", label: "Presale", field_type: "text" },
      { sectionKey: "dates", order: 4, sort_order: 1, field_name: "registration_deadline", label: "Дедлайн регистрации", field_type: "date" },
      { sectionKey: "links", order: 5, sort_order: 1, field_name: "project_map_link", label: "Project map", field_type: "text" },
      { sectionKey: "links", order: 5, sort_order: 2, field_name: "kaiten_link", label: "Kaiten", field_type: "text" },
    ],
  };

  const defaults = entity === "company" ? defaultsCompany : defaultsDeal;
  const systemFields = new Set(
    entity === "company"
      ? ["name", "inn", "city", "website", "email", "phone", "sales_channel_id"]
      : [
          "title",
          "company_id",
          "sales_channel",
          "partner",
          "distributor",
          "purchase_format",
          "activity_type",
          "budget",
          "turnover",
          "margin_percent",
          "discount_percent",
          "infrastructure_size",
          "endpoints",
          "presale",
          "registration_deadline",
          "project_map_link",
          "kaiten_link",
        ]
  );

  const sections = defaults.sections.map((s) => ({
    id: `__default_section__${s.key}`,
    entity_type: entity,
    key: s.key,
    title: s.title,
    order: s.order,
    collapsed: !!s.collapsed,
  })) as SettingsSection[];

  const sectionByKey = new Map(sections.map((s) => [s.key, s.id]));
  const fields = defaults.fields.map((d) => ({
    id: `__default_field__${String(d.field_name)}`,
    collection: collectionName,
    field_name: String(d.field_name),
    label: String(d.label || d.field_name),
    field_type: String(d.field_type || "text"),
    value_type: inferValueType(d as SettingsField),
    required: !!d.required,
    visible: true,
    options: d.options || {},
    section_id: sectionByKey.get(d.sectionKey),
    order: d.order,
    sort_order: d.sort_order,
    system: systemFields.has(String(d.field_name)),
    help_text: "",
  })) as SettingsField[];

  return { sections, fields };
}

export function DynamicEntityForm(
  {
    entity,
    record,
    onSaved,
  }: {
    entity: EntityType;
    record: any;
    onSaved?: () => void;
  },
  ref: React.Ref<DynamicEntityFormHandle>
) {
  const collectionName = entity === "company" ? "companies" : "deals";
  const valueCollection = entity === "company" ? "company_field_values" : "deal_field_values";
  const recordId: string | undefined = record?.id;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [sections, setSections] = React.useState<SettingsSection[]>([]);
  const [fields, setFields] = React.useState<SettingsField[]>([]);
  const [values, setValues] = React.useState<Record<string, any>>({});
  const [valueRowByField, setValueRowByField] = React.useState<Record<string, FieldValueRow>>({});
  const [relationOptions, setRelationOptions] = React.useState<Record<string, any[]>>({});

  async function loadAll() {
    if (!recordId) return;
    setLoading(true);

    const entityFilter = `entity_type=\"${entity}\"`;
    const [dbSections, dbFields] = await Promise.all([
      pb.collection("settings_field_sections").getFullList({ filter: entityFilter, sort: "order" }).catch(() => []),
      pb.collection("settings_fields").getFullList({ filter: entityFilter, sort: "order,sort_order" }).catch(() => []),
    ]);

    const fallback = getDefaultConfig(entity, collectionName);
    const secList = (dbSections as any[]).length ? (dbSections as SettingsSection[]) : fallback.sections;
    const fieldList = ((dbFields as any[]).length ? (dbFields as SettingsField[]) : fallback.fields).filter((x) => x.visible !== false);

    setSections(secList.length ? secList : [{ id: "__default__", entity_type: entity, key: "default", title: "Основное" }]);
    setFields(fieldList);

    const filter = entity === "company" ? `company_id=\"${recordId}\"` : `deal_id=\"${recordId}\"`;
    const rows = (await pb.collection(valueCollection).getFullList({ filter }).catch(() => [])) as any[];
    const map: Record<string, FieldValueRow> = {};
    const nextValues: Record<string, any> = {};

    for (const r of rows) {
      map[r.field_id] = r as FieldValueRow;
      nextValues[r.field_id] = r.value_json ?? r.value_date ?? r.value_number ?? r.value_text ?? "";
    }

    for (const field of fieldList) {
      const fn = field.field_name;
      if (fn && Object.prototype.hasOwnProperty.call(record || {}, fn) && nextValues[field.id] === undefined) {
        nextValues[field.id] = record?.[fn] ?? "";
      }
    }

    const relFields = fieldList.filter((f) => (f.field_type || "") === "relation");
    const relMap: Record<string, any[]> = {};
    for (const rf of relFields) {
      const opts = parseOptions(rf.options);
      const col = opts.collection;
      if (!col) continue;
      const items = await pb.collection(col).getList(1, 200, { sort: "-created" }).then((x) => x.items).catch(() => []);
      relMap[rf.id] = items as any[];
    }

    setValueRowByField(map);
    setValues(nextValues);
    setRelationOptions(relMap);
    setLoading(false);
  }

  React.useEffect(() => {
    if (!recordId) return;
    loadAll();
  }, [recordId, entity]);

  function setFieldValue(fieldId: string, next: any) {
    setValues((p) => ({ ...p, [fieldId]: next }));
  }

  async function save() {
    if (!recordId) return;
    setSaving(true);
    const previousRecord: Record<string, any> = {};
    const previousValueRows: Array<{ existing?: FieldValueRow }> = [];
    const createdRowIds: string[] = [];

    try {
      const updatePayload: Record<string, any> = {};
      const toUpsert: Array<{ field: SettingsField; value: any }> = [];

      for (const f of fields) {
        const val = values[f.id];
        const fn = f.field_name;
        const normalized = val === "" ? null : val;
        const isSystemLike = !!f.system || Object.prototype.hasOwnProperty.call(record || {}, fn);

        if (isSystemLike && fn) {
          previousRecord[fn] = record?.[fn] ?? null;
          updatePayload[fn] = f.field_type === "number" && normalized !== null ? Number(normalized) : normalized;
        } else if (!String(f.id).startsWith("__default_field__")) {
          previousValueRows.push({ existing: valueRowByField[f.id] });
          toUpsert.push({ field: f, value: normalized });
        }
      }

      for (const it of toUpsert) {
        const f = it.field;
        const existing = valueRowByField[f.id];
        const base: any = entity === "company" ? { company_id: recordId, field_id: f.id } : { deal_id: recordId, field_id: f.id };
        const vt = inferValueType(f);
        const payload: any = { ...base, value_text: null, value_number: null, value_date: null, value_json: null };

        if (it.value !== null && it.value !== undefined) {
          if (vt === "number") payload.value_number = Number(it.value);
          else if (vt === "date") payload.value_date = String(it.value);
          else if (vt === "json") payload.value_json = it.value;
          else payload.value_text = String(it.value);
        }

        if (existing?.id) {
          await pb.collection(valueCollection).update(existing.id, payload);
        } else {
          const created = await pb.collection(valueCollection).create(payload);
          createdRowIds.push((created as any).id);
          setValueRowByField((p) => ({ ...p, [f.id]: created as any }));
        }
      }

      if (Object.keys(updatePayload).length) {
        await pb.collection(collectionName).update(recordId, updatePayload);
      }

      onSaved?.();
    } catch (error) {
      try {
        await Promise.all(createdRowIds.map((rowId) => pb.collection(valueCollection).delete(rowId).catch(() => null)));
        for (const item of previousValueRows) {
          const existing = item.existing;
          if (!existing?.id) continue;
          await pb.collection(valueCollection).update(existing.id, {
            value_text: existing.value_text ?? null,
            value_number: existing.value_number ?? null,
            value_date: existing.value_date ?? null,
            value_json: existing.value_json ?? null,
          }).catch(() => null);
        }
        if (Object.keys(previousRecord).length) {
          await pb.collection(collectionName).update(recordId, previousRecord).catch(() => null);
        }
      } catch {
        // rollback best-effort only
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }

  React.useImperativeHandle(ref, () => ({ save }), [save]);

  const fieldsBySection = React.useMemo(() => {
    const map: Record<string, SettingsField[]> = {};
    for (const s of sections) map[s.id] = [];
    for (const f of fields) {
      const sid = f.section_id || "__default__";
      if (!map[sid]) map[sid] = [];
      map[sid].push(f);
    }
    Object.keys(map).forEach((k) => {
      map[k] = map[k].slice().sort((a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0));
    });
    return map;
  }, [fields, sections]);

  const sortedSections = React.useMemo(() => {
    return sections
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter((s) => (fieldsBySection[s.id]?.length ?? 0) > 0);
  }, [sections, fieldsBySection]);

  if (loading) return <div className="text-sm text-text2">Загрузка формы...</div>;

  return (
    <div className="grid gap-4">
      {sortedSections.map((s) => (
        <div key={s.id} className="rounded-card border border-border bg-rowHover p-3">
          <div className="text-sm font-semibold mb-3">{s.title}</div>
          <div className="grid gap-3">
            {(fieldsBySection[s.id] ?? []).map((f) => {
              const opts = parseOptions(f.options);
              const val = values[f.id] ?? "";
              const label = f.label || f.field_name;
              const required = !!f.required;

              if (f.field_type === "select") {
                const list = Array.isArray(opts.values) ? opts.values : [];
                return (
                  <div key={f.id} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-4 text-xs text-text2">{label}{required ? " *" : ""}</div>
                    <div className="col-span-8">
                      <select className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm" value={String(val ?? "")} onChange={(e) => setFieldValue(f.id, e.target.value)}>
                        <option value="">—</option>
                        {list.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                  </div>
                );
              }

              if (f.field_type === "relation") {
                const list = relationOptions[f.id] || [];
                const labelField = opts.labelField || "name";
                return (
                  <div key={f.id} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-4 text-xs text-text2">{label}{required ? " *" : ""}</div>
                    <div className="col-span-8">
                      <select className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm" value={String(val ?? "")} onChange={(e) => setFieldValue(f.id, e.target.value)}>
                        <option value="">—</option>
                        {list.map((it: any) => <option key={it.id} value={it.id}>{it[labelField] ?? it.id}</option>)}
                      </select>
                    </div>
                  </div>
                );
              }

              const type = f.field_type === "number" ? "number" : f.field_type === "email" ? "email" : f.field_type === "date" ? "date" : "text";
              return (
                <div key={f.id} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4 text-xs text-text2">{label}{required ? " *" : ""}</div>
                  <div className="col-span-8">
                    <Input type={type as any} value={String(val ?? "")} onChange={(e) => setFieldValue(f.id, (e.target as any).value)} placeholder={f.help_text || ""} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
      </div>
    </div>
  );
}

export const DynamicEntityFormWithRef = React.forwardRef(DynamicEntityForm);
