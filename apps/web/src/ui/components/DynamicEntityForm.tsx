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
  if (t === "select") return "text";
  if (t === "relation") return "text";
  return "text";
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
  const [values, setValues] = React.useState<Record<string, any>>({}); // by field_id
  const [valueRowByField, setValueRowByField] = React.useState<Record<string, FieldValueRow>>({});
  const [relationOptions, setRelationOptions] = React.useState<Record<string, any[]>>({}); // field_id -> items

  // Ensure a minimal default config exists (so UI isn't empty on first run)
  async function ensureDefaults() {
    const entityFilter = `entity_type=\"${entity}\"`;
    const existing = await pb.collection("settings_fields").getList(1, 1, { filter: entityFilter }).catch(() => null);
    if (existing && existing.totalItems > 0) return;

    // create a default section
    const sec = await pb.collection("settings_field_sections").create({
      entity_type: entity,
      key: "main",
      title: entity === "company" ? "Основное" : "Основное",
      order: 1,
      collapsed: false,
    });

    const defaults: Array<Partial<SettingsField>> =
      entity === "company"
        ? [
            { field_name: "name", label: "Название", field_type: "text", required: true },
            { field_name: "inn", label: "ИНН", field_type: "text" },
            { field_name: "city", label: "Город", field_type: "text" },
            { field_name: "website", label: "Сайт", field_type: "text" },
            // configurable sales channel
            { field_name: "sales_channel_id", label: "Канал продаж", field_type: "relation", options: { collection: "sales_channels", labelField: "name" } },
          ]
        : [
            { field_name: "title", label: "Название сделки", field_type: "text", required: true },
            // configurable company link
            { field_name: "company_id", label: "Компания", field_type: "relation", options: { collection: "companies", labelField: "name" } },
            { field_name: "budget", label: "Бюджет", field_type: "number" },
          ];

    let order = 1;
    for (const d of defaults) {
      await pb.collection("settings_fields").create({
        collection: collectionName,
        entity_type: entity,
        section_id: sec.id,
        field_name: d.field_name,
        label: d.label,
        field_type: d.field_type,
        value_type: inferValueType(d as any),
        required: !!d.required,
        visible: true,
        options: d.options || {},
        sort_order: order,
        order,
        system: true,
        help_text: "",
        role_visibility: {},
      });
      order++;
    }
  }

  async function loadAll() {
    if (!recordId) return;
    setLoading(true);
    await ensureDefaults();
    const entityFilter = `entity_type=\"${entity}\"`;
    const [sec, flds] = await Promise.all([
      pb.collection("settings_field_sections").getFullList({ filter: entityFilter, sort: "order" }).catch(() => []),
      pb.collection("settings_fields").getFullList({ filter: entityFilter, sort: "order,sort_order" }).catch(() => []),
    ]);

    const secList = (sec as any[]).map((x) => x as SettingsSection);
    const fieldList = (flds as any[])
      .map((x) => x as SettingsField)
      .filter((x) => x.visible !== false);

    // If sections are missing, create a fallback synthetic section
    if (!secList.length) {
      secList.push({ id: "__default__", entity_type: entity, key: "default", title: "Основное" });
    }

    setSections(secList);
    setFields(fieldList);

    // Load custom values
    const filter = entity === "company" ? `company_id=\"${recordId}\"` : `deal_id=\"${recordId}\"`;
    const rows = (await pb.collection(valueCollection).getFullList({ filter }).catch(() => [])) as any[];
    const map: Record<string, FieldValueRow> = {};
    const v: Record<string, any> = {};
    for (const r of rows) {
      map[r.field_id] = r as any;
      v[r.field_id] = r.value_json ?? r.value_date ?? r.value_number ?? r.value_text ?? "";
    }

    // Prime values from main record for system fields (if present)
    for (const field of fieldList) {
      const fn = field.field_name;
      if (fn && record && Object.prototype.hasOwnProperty.call(record, fn)) {
        // store in field_id state so we can render consistently
        if (v[field.id] === undefined) v[field.id] = record[fn] ?? "";
      }
    }

    setValueRowByField(map);
    setValues(v);

    // Preload relation options
    const relFields = fieldList.filter((f) => (f.field_type || "") === "relation");
    const relMap: Record<string, any[]> = {};
    for (const rf of relFields) {
      const opts = parseOptions(rf.options);
      const col = opts.collection;
      if (!col) continue;
      const items = await pb
        .collection(col)
        .getList(1, 200, { sort: "-created" })
        .then((x) => x.items)
        .catch(() => []);
      relMap[rf.id] = items as any[];
    }
    setRelationOptions(relMap);

    setLoading(false);
  }

  React.useEffect(() => {
    if (!recordId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, entity]);

  function setFieldValue(fieldId: string, next: any) {
    setValues((p) => ({ ...p, [fieldId]: next }));
  }

  async function save() {
    if (!recordId) return;
    setSaving(true);
    try {
      const updatePayload: Record<string, any> = {};
      const toUpsert: Array<{ field: SettingsField; value: any }> = [];

      for (const f of fields) {
        const val = values[f.id];
        const fn = f.field_name;
        const vt = inferValueType(f);
        const normalized = val === "" ? null : val;

        const isSystemLike = f.system || (record && Object.prototype.hasOwnProperty.call(record, fn));

        if (isSystemLike && fn) {
          // write into main record
          if (f.field_type === "number") {
            updatePayload[fn] = normalized === null ? null : Number(normalized);
          } else {
            updatePayload[fn] = normalized;
          }
        } else {
          toUpsert.push({ field: f, value: normalized });
        }
      }

      // Update main record first
      if (Object.keys(updatePayload).length) {
        await pb.collection(collectionName).update(recordId, updatePayload);
      }

      // Upsert field values
      for (const it of toUpsert) {
        const f = it.field;
        const val = it.value;
        const existing = valueRowByField[f.id];
        const base: any = entity === "company" ? { company_id: recordId, field_id: f.id } : { deal_id: recordId, field_id: f.id };

        const vt = inferValueType(f);
        const payload: any = { ...base, value_text: null, value_number: null, value_date: null, value_json: null };
        if (val === null || val === undefined) {
          // keep as nulls
        } else if (vt === "number") {
          payload.value_number = Number(val);
        } else if (vt === "date") {
          payload.value_date = String(val);
        } else if (vt === "json") {
          payload.value_json = val;
        } else {
          payload.value_text = String(val);
        }

        if (existing?.id) await pb.collection(valueCollection).update(existing.id, payload);
        else {
          const created = await pb.collection(valueCollection).create(payload);
          setValueRowByField((p) => ({ ...p, [f.id]: created as any }));
        }
      }

      onSaved?.();
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
    // sort inside
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
                    <div className="col-span-4 text-xs text-text2">
                      {label}{required ? " *" : ""}
                    </div>
                    <div className="col-span-8">
                      <select
                        className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm"
                        value={String(val ?? "")}
                        onChange={(e) => setFieldValue(f.id, e.target.value)}
                      >
                        <option value="">—</option>
                        {list.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
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
                    <div className="col-span-4 text-xs text-text2">
                      {label}{required ? " *" : ""}
                    </div>
                    <div className="col-span-8">
                      <select
                        className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm"
                        value={String(val ?? "")}
                        onChange={(e) => setFieldValue(f.id, e.target.value)}
                      >
                        <option value="">—</option>
                        {list.map((it: any) => (
                          <option key={it.id} value={it.id}>
                            {it[labelField] ?? it.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }

              const type = f.field_type === "number" ? "number" : f.field_type === "email" ? "email" : f.field_type === "date" ? "date" : "text";
              return (
                <div key={f.id} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4 text-xs text-text2">
                    {label}{required ? " *" : ""}
                  </div>
                  <div className="col-span-8">
                    <Input
                      type={type as any}
                      value={String(val ?? "")}
                      onChange={(e) => setFieldValue(f.id, (e.target as any).value)}
                      placeholder={f.help_text || ""}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}

export const DynamicEntityFormWithRef = React.forwardRef(DynamicEntityForm);
