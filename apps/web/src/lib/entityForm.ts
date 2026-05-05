import { pb } from './pb';

export type EntityType = 'company' | 'deal';

export type FieldOptionConfig = {
  values?: string[];
  collection?: string;
  labelField?: string;
};

export type SettingsField = {
  id: string;
  collection?: string;
  field_name: string;
  label: string;
  field_type: string;
  value_type?: string;
  required?: boolean;
  visible?: boolean;
  options?: FieldOptionConfig | string | null;
  section_id?: string;
  order?: number;
  sort_order?: number;
  system?: boolean;
  help_text?: string;
};

export type SettingsSection = {
  id: string;
  entity_type: EntityType;
  key: string;
  title: string;
  order?: number;
  collapsed?: boolean;
};

export type FieldValueRow = {
  id: string;
  field_id: string;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_json?: unknown;
};

export type RecordLike = {
  id?: string;
  [key: string]: unknown;
};

export type SaveEntityFormInput = {
  entity: EntityType;
  recordId: string;
  record: RecordLike;
  fields: SettingsField[];
  values: Record<string, unknown>;
  valueRowByField: Record<string, FieldValueRow>;
};

export type SaveEntityFormResult = {
  createdRowsByField: Record<string, FieldValueRow>;
};

export function parseFieldOptions(raw: SettingsField['options']): FieldOptionConfig {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as FieldOptionConfig;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw;
}

export function inferFieldValueType(f: Pick<SettingsField, 'value_type' | 'field_type'>): 'text' | 'number' | 'date' | 'json' {
  const vt = String(f.value_type || '').trim();
  if (vt === 'number' || vt === 'date' || vt === 'json' || vt === 'text') return vt;
  const t = String(f.field_type || 'text').trim();
  if (t === 'number') return 'number';
  if (t === 'date') return 'date';
  return 'text';
}

function getCollectionName(entity: EntityType): string {
  return entity === 'company' ? 'companies' : 'deals';
}

function getValueCollectionName(entity: EntityType): string {
  return entity === 'company' ? 'company_field_values' : 'deal_field_values';
}

function buildFieldValueBase(entity: EntityType, recordId: string, fieldId: string): Record<string, string> {
  return entity === 'company'
    ? { company_id: recordId, field_id: fieldId }
    : { deal_id: recordId, field_id: fieldId };
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildValuePayload(entity: EntityType, recordId: string, field: SettingsField, rawValue: unknown): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...buildFieldValueBase(entity, recordId, field.id),
    value_text: null,
    value_number: null,
    value_date: null,
    value_json: null,
  };

  if (rawValue === null || rawValue === undefined || rawValue === '') return payload;

  const vt = inferFieldValueType(field);
  if (vt === 'number') {
    payload.value_number = normalizeNumber(rawValue);
  } else if (vt === 'date') {
    payload.value_date = String(rawValue);
  } else if (vt === 'json') {
    payload.value_json = rawValue;
  } else {
    payload.value_text = String(rawValue);
  }

  return payload;
}

export async function saveEntityFormData(input: SaveEntityFormInput): Promise<SaveEntityFormResult> {
  const { entity, recordId, record, fields, values, valueRowByField } = input;
  const collectionName = getCollectionName(entity);
  const valueCollectionName = getValueCollectionName(entity);

  const updatePayload: Record<string, unknown> = {};
  const customFields: Array<{ field: SettingsField; value: unknown }> = [];

  for (const field of fields) {
    const fieldName = field.field_name;
    const value = values[field.id];
    const normalized = value === '' ? null : value;
    const isSystemLike = Boolean(field.system) || Object.prototype.hasOwnProperty.call(record, fieldName);

    if (isSystemLike && fieldName) {
      updatePayload[fieldName] = field.field_type === 'number' ? normalizeNumber(normalized) : normalized;
    } else {
      customFields.push({ field, value: normalized });
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    await pb.collection(collectionName).update(recordId, updatePayload);
  }

  const createdRowsByField: Record<string, FieldValueRow> = {};

  for (const item of customFields) {
    const existing = valueRowByField[item.field.id];
    const payload = buildValuePayload(entity, recordId, item.field, item.value);

    if (existing?.id) {
      await pb.collection(valueCollectionName).update(existing.id, payload);
      continue;
    }

    const created = await pb.collection(valueCollectionName).create(payload);
    createdRowsByField[item.field.id] = created as unknown as FieldValueRow;
  }

  return { createdRowsByField };
}
