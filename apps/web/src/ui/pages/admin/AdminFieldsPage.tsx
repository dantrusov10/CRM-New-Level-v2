import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb, ensureCollectionField } from "../../../lib/pb";


const BASE_FIELDS: Record<string, { name: string; type: string }[]> = {
  companies: [
    { name: "name", type: "text" },
    { name: "responsible_id", type: "text" },
    { name: "phone", type: "text" },
    { name: "email", type: "email" },
    { name: "city", type: "text" },
    { name: "website", type: "text" },
    { name: "address", type: "text" },
    { name: "inn", type: "text" },
    { name: "legal_entity", type: "text" },
  ],
  deals: [
    { name: "title", type: "text" },
    { name: "company_id", type: "text" },
    { name: "responsible_id", type: "text" },
    { name: "stage_id", type: "text" },
    { name: "budget", type: "number" },
    { name: "turnover", type: "number" },
    { name: "margin_percent", type: "number" },
    { name: "discount_percent", type: "number" },
    { name: "sales_channel", type: "text" },
    { name: "partner", type: "text" },
    { name: "distributor", type: "text" },
    { name: "purchase_format", type: "text" },
    { name: "activity_type", type: "text" },
    { name: "endpoints", type: "number" },
    { name: "infrastructure_size", type: "text" },
    { name: "presale", type: "text" },
    { name: "attraction_channel", type: "text" },
    { name: "attraction_date", type: "date" },
    { name: "registration_deadline", type: "date" },
    { name: "test_start", type: "date" },
    { name: "test_end", type: "date" },
    { name: "delivery_date", type: "date" },
    { name: "expected_payment_date", type: "date" },
    { name: "payment_received_date", type: "date" },
    { name: "project_map_link", type: "text" },
    { name: "kaiten_link", type: "text" },
    { name: "current_score", type: "number" },
    { name: "current_recommendations", type: "text" },
  ],
};

function humanize(s: string) {
  const map: Record<string, string> = {
    name: "Название",
    title: "Название",
    inn: "ИНН",
    website: "Сайт",
    city: "Город",
    phone: "Телефон",
    email: "Email",
    address: "Адрес",
    legal_entity: "Юр.лицо",
    budget: "Бюджет",
    turnover: "Оборот",
    margin_percent: "Маржа %",
    discount_percent: "Скидка %",
    stage_id: "Этап",
    company_id: "Компания",
    responsible_id: "Ответственный",
    sales_channel: "Канал продаж",
    purchase_format: "Формат закупки",
    endpoints: "Конечные точки",
    presale: "Presale",
    project_map_link: "Ссылка на карту проекта",
    kaiten_link: "Kaiten",
    current_score: "Score",
    current_recommendations: "Рекомендации",
  };
  return map[s] ?? s.replace(/_/g, " ");
}

const FIELD_TYPES = [
  { v: "text", l: "Текст" },
  { v: "number", l: "Число" },
  { v: "date", l: "Дата" },
  { v: "email", l: "Email" },
  { v: "select", l: "Выбор из списка" },
];

export function AdminFieldsPage() {
  const [items, setItems] = React.useState<any[]>([]);

  const [collection, setCollection] = React.useState("companies");
  const [fieldName, setFieldName] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [fieldType, setFieldType] = React.useState("text");
  const [required, setRequired] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [options, setOptions] = React.useState("");

  async function load() {
    const res = await pb.collection("settings_fields").getFullList({
      sort: "sort_order",
      filter: `collection=\"${collection}\"`,
    });

    // ensure базовые поля тоже попадают в настройки (для управления label/видимостью/порядком)
    const base = BASE_FIELDS[collection] ?? [];
    const existing = new Set((res as any[]).map((x) => String(x.field_name)));

    for (const bf of base) {
      if (!existing.has(bf.name)) {
        try {
          await pb.collection("settings_fields").create({
            collection,
            field_name: bf.name,
            label: humanize(bf.name),
            field_type: bf.type,
            required: false,
            visible: true,
            options: {},
            sort_order: (res as any[]).length + 1,
            role_visibility: {},
          });
        } catch {
          // ignore race conditions
        }
      }
    }

    const res2 = await pb.collection("settings_fields").getFullList({
      sort: "sort_order",
      filter: `collection=\"${collection}\"`,
    });
    setItems(res2 as any);
  }

  React.useEffect(() => {
    load();
  }, [collection]);
async function add() {
    const sort_order = items.length + 1;

    await pb.collection("settings_fields").create({
      collection,
      field_name: fieldName,
      label,
      field_type: fieldType,
      required,
      visible,
      options: options ? { values: options.split(",").map((s) => s.trim()).filter(Boolean) } : {},
      sort_order,
      role_visibility: {},
    });

    // ensure real PB schema field exists (requires PB superuser creds in env)
    // This is needed so the field can actually store values inside companies/deals records.
    try {
      const pbType =
        fieldType === "number"
          ? "number"
          : fieldType === "date"
            ? "date"
            : fieldType === "email"
              ? "email"
              : fieldType === "select"
                ? "select"
                : "text";

      const schemaField: any = {
        name: fieldName,
        type: pbType,
        system: false,
        required: !!required,
        options: {},
      };

      if (pbType === "number") schemaField.options = { min: null, max: null };
      if (pbType === "date") schemaField.options = { min: "", max: "" };
      if (pbType === "select") {
        const vals = options
          ? options.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        schemaField.options = { maxSelect: 1, values: vals };
      }

      await ensureCollectionField(collection, schemaField);
    } catch {
      // if admin creds not provided - field will still be a config record,
      // but it won't be able to store values until PB schema is updated.
    }

    setFieldName("");
    setLabel("");
    setOptions("");
    load();
  }

  async function update(id: string, data: any) {
(id: string, data: any) {
    await pb.collection("settings_fields").update(id, data);
    load();
  }

  async function remove(id: string) {
    await pb.collection("settings_fields").delete(id);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Конструктор полей</div>
        <div className="text-xs text-text2 mt-1">Добавление полей (тип, обязательность, сортировка, видимость)</div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="rounded-card border border-border bg-rowHover p-3">
            <div className="grid grid-cols-6 gap-2 items-end">
              <div>
                <div className="text-xs text-text2 mb-1">Сущность</div>
                <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={collection} onChange={(e) => setCollection(e.target.value)}>
                  <option value="companies">Компании</option>
                  <option value="deals">Сделки</option>
                </select>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-text2 mb-1">Имя поля (system)</div>
                <Input value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="industry" />
              </div>
              <div className="col-span-2">
                <div className="text-xs text-text2 mb-1">Название (label)</div>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Отрасль" />
              </div>
              <div>
                <div className="text-xs text-text2 mb-1">Тип</div>
                <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={fieldType} onChange={(e) => setFieldType(e.target.value)}>
                  {FIELD_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <div className="text-xs text-text2 mb-1">Опции (для select, через запятую)</div>
                <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="FinTech, Retail, Telecom" />
              </div>
              <div className="flex items-center gap-3 col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
                  Обязательное
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                  Видимое
                </label>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button onClick={add} disabled={!fieldName.trim() || !label.trim()}>Добавить</Button>
              </div>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                  <th className="text-left px-3">Сущность</th>
                  <th className="text-left px-3">Имя</th>
                  <th className="text-left px-3">Label</th>
                  <th className="text-left px-3">Тип</th>
                  <th className="text-left px-3">Порядок</th>
                  <th className="text-left px-3">Req</th>
                  <th className="text-left px-3">Visible</th>
                  <th className="text-right px-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="h-11 border-b border-border">
                    <td className="px-3 text-text2">{it.collection}</td>
                    <td className="px-3">{it.field_name}</td>
                    <td className="px-3">
                      <Input value={it.label} onChange={(e) => update(it.id, { label: e.target.value })} />
                    </td>
                    <td className="px-3">
                      <select className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm" value={it.field_type} onChange={(e) => update(it.id, { field_type: e.target.value })}>
                        {FIELD_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                    </td>
                    <td className="px-3 w-[110px]">
                      <Input value={String(it.sort_order ?? 0)} onChange={(e) => update(it.id, { sort_order: Number(e.target.value || 0) })} />
                    </td>
                    <td className="px-3"><input type="checkbox" checked={!!it.required} onChange={(e) => update(it.id, { required: e.target.checked })} /></td>
                    <td className="px-3"><input type="checkbox" checked={!!it.visible} onChange={(e) => update(it.id, { visible: e.target.checked })} /></td>
                    <td className="px-3 text-right"><Button variant="danger" small onClick={() => remove(it.id)}>Удалить</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length ? <div className="text-sm text-text2 py-6">Поля пока не настроены.</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
