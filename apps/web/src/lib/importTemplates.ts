import { downloadXlsx } from "./importExport";
import { pb } from "./pb";
import { DEAL_SYSTEM_PB_FIELDS, normalizeDealFieldName } from "./canonicalFields";

type SettingsFieldRecord = {
  label?: string;
  field_name?: string;
};

type ImportRowData = Record<string, string | number | boolean | null | undefined>;

function pushUniqueHeader(seen: Set<string>, headers: string[], h0: string) {
  const base = String(h0 || "").trim();
  if (!base) return;
  let h = base;
  let i = 2;
  while (seen.has(h)) {
    h = `${base} (${i})`;
    i += 1;
  }
  seen.add(h);
  headers.push(h);
}

export async function downloadBundleImportTemplate() {
  const dealFields = (await pb
    .collection("settings_fields")
    .getFullList({ filter: `entity_type="deal" && (visible=true || required=true)`, sort: "order,sort_order" })
    .catch(() => [])) as SettingsFieldRecord[];

  const companyFields = (await pb
    .collection("settings_fields")
    .getFullList({ filter: `entity_type="company" && (visible=true || required=true)`, sort: "order,sort_order" })
    .catch(() => [])) as SettingsFieldRecord[];

  const seen = new Set<string>();
  const headers: string[] = [];
  const pushH = (h0: string) => pushUniqueHeader(seen, headers, h0);

  pushH("Компания: Название компании");
  pushH("Компания: ИНН");
  pushH("Компания: Город");
  pushH("Компания: Сайт");
  pushH("Компания: Телефон");
  pushH("Компания: Email");

  for (const f of companyFields) {
    const lbl = String(f?.label ?? "").trim();
    const fieldName = String(f?.field_name ?? "").trim();
    if (!lbl || !fieldName) continue;
    if (["name", "inn", "city", "website", "phone", "email"].includes(fieldName)) continue;
    pushH(`Компания: ${lbl}`);
  }

  pushH("Сделка: Название сделки");
  pushH("Сделка: Этап");
  pushH("Сделка: Бюджет");
  pushH("Сделка: Оборот");
  pushH("Сделка: Маржа, %");
  pushH("Сделка: Скидка, %");

  for (const f of dealFields) {
    const lbl = String(f?.label ?? "").trim();
    const fieldName = String(f?.field_name ?? "").trim();
    if (!lbl || !fieldName) continue;
    const canon = normalizeDealFieldName(fieldName);
    if (canon && DEAL_SYSTEM_PB_FIELDS.includes(canon)) continue;
    pushH(`Сделка: ${lbl}`);
  }

  for (let i = 1; i <= 5; i++) pushH(`Примечание ${i}`);
  for (let i = 1; i <= 3; i++) {
    pushH(`Контакт ${i}: ФИО`);
    pushH(`Контакт ${i}: Должность`);
    pushH(`Контакт ${i}: Телефон`);
    pushH(`Контакт ${i}: Email`);
    pushH(`Контакт ${i}: Telegram`);
  }

  const row: ImportRowData = {};
  for (const h of headers) row[h] = "";
  downloadXlsx([row], "bundle", "template_deal_company_contacts.xlsx");
}

export async function downloadDealImportTemplate() {
  const fields = (await pb
    .collection("settings_fields")
    .getFullList({ filter: `entity_type="deal" && (visible=true || required=true)`, sort: "order,sort_order" })
    .catch(() => [])) as SettingsFieldRecord[];

  const seen = new Set<string>();
  const headers: string[] = [];
  for (const f of fields) {
    const h0 = String(f?.label ?? "").trim();
    if (!h0) continue;
    pushUniqueHeader(seen, headers, h0);
  }
  for (let i = 1; i <= 5; i++) headers.push(`Примечание ${i}`);

  const row: ImportRowData = {};
  for (const h of headers) row[h] = "";
  downloadXlsx([row], "deals", "template_deals.xlsx");
}

export async function downloadCompanyImportTemplate() {
  const companyFields = (await pb
    .collection("settings_fields")
    .getFullList({ filter: `entity_type="company" && (visible=true || required=true)`, sort: "order,sort_order" })
    .catch(() => [])) as SettingsFieldRecord[];

  const seen = new Set<string>();
  const headers: string[] = [];
  pushUniqueHeader(seen, headers, "Название компании");
  pushUniqueHeader(seen, headers, "ИНН");
  pushUniqueHeader(seen, headers, "Город");
  pushUniqueHeader(seen, headers, "Сайт");
  pushUniqueHeader(seen, headers, "Телефон");
  pushUniqueHeader(seen, headers, "Email");

  for (const f of companyFields) {
    const lbl = String(f?.label ?? "").trim();
    const fieldName = String(f?.field_name ?? "").trim();
    if (!lbl || !fieldName) continue;
    if (["name", "inn", "city", "website", "phone", "email"].includes(fieldName)) continue;
    pushUniqueHeader(seen, headers, lbl);
  }

  const row: ImportRowData = {};
  for (const h of headers) row[h] = "";
  downloadXlsx([row], "companies", "template_companies.xlsx");
}
