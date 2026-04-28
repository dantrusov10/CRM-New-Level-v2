import React from 'react';
import { pb } from '../../lib/pb';
import type { Company, Deal, RelationOption } from '../../lib/types';
import {
  type EntityType,
  type FieldValueRow,
  type RecordLike,
  type SettingsField,
  type SettingsSection,
  inferFieldValueType,
  parseFieldOptions,
  saveEntityFormData,
} from '../../lib/entityForm';
import { Input } from './Input';
import { Button } from './Button';

export type DynamicEntityFormHandle = {
  save: () => Promise<void>;
};

type DynamicEntityFormProps = {
  entity: EntityType;
  record: Partial<Company & Deal> & RecordLike;
  onSaved?: () => void;
};

type InputType = 'text' | 'number' | 'email' | 'date';

export function DynamicEntityForm(
  { entity, record, onSaved }: DynamicEntityFormProps,
  ref: React.Ref<DynamicEntityFormHandle>
) {
  const recordId = record?.id;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [sections, setSections] = React.useState<SettingsSection[]>([]);
  const [fields, setFields] = React.useState<SettingsField[]>([]);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [valueRowByField, setValueRowByField] = React.useState<Record<string, FieldValueRow>>({});
  const [relationOptions, setRelationOptions] = React.useState<Record<string, RelationOption[]>>({});

  async function loadAll() {
    if (!recordId) return;
    setLoading(true);

    const entityFilter = `entity_type="${entity}"`;
    const [sec, flds] = await Promise.all([
      pb.collection('settings_field_sections').getFullList<SettingsSection>({ filter: entityFilter, sort: 'order' }).catch(() => []),
      pb.collection('settings_fields').getFullList<SettingsField>({ filter: entityFilter, sort: 'order,sort_order' }).catch(() => []),
    ]);

    const secList = sec.map((item) => ({ ...item }));
    const fieldList = flds.filter((item) => item.visible !== false);

    if (!secList.length) {
      secList.push({ id: '__default__', entity_type: entity, key: 'default', title: 'Основное' });
    }

    setSections(secList);
    setFields(fieldList);

    const filter = entity === 'company' ? `company_id="${recordId}"` : `deal_id="${recordId}"`;
    const rows = await pb.collection(entity === 'company' ? 'company_field_values' : 'deal_field_values').getFullList<FieldValueRow>({ filter }).catch(() => []);

    const nextRowsByField: Record<string, FieldValueRow> = {};
    const nextValues: Record<string, unknown> = {};

    for (const row of rows) {
      nextRowsByField[row.field_id] = row;
      nextValues[row.field_id] = row.value_json ?? row.value_date ?? row.value_number ?? row.value_text ?? '';
    }

    for (const field of fieldList) {
      const fieldName = field.field_name;
      if (fieldName && Object.prototype.hasOwnProperty.call(record, fieldName) && nextValues[field.id] === undefined) {
        nextValues[field.id] = record[fieldName] ?? '';
      }
    }

    setValueRowByField(nextRowsByField);
    setValues(nextValues);

    const relFields = fieldList.filter((field) => field.field_type === 'relation');
    const nextRelationOptions: Record<string, RelationOption[]> = {};

    for (const field of relFields) {
      const options = parseFieldOptions(field.options);
      if (!options.collection) continue;
      const result = await pb
        .collection(options.collection)
        .getList<RelationOption>(1, 200, { sort: '-created' })
        .then((response) => response.items)
        .catch(() => []);
      nextRelationOptions[field.id] = result;
    }

    setRelationOptions(nextRelationOptions);
    setLoading(false);
  }

  React.useEffect(() => {
    if (!recordId) return;
    void loadAll();
  }, [recordId, entity]);

  function setFieldValue(fieldId: string, next: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: next }));
  }

  async function save() {
    if (!recordId) return;
    setSaving(true);
    try {
      const result = await saveEntityFormData({
        entity,
        recordId,
        record,
        fields,
        values,
        valueRowByField,
      });

      if (Object.keys(result.createdRowsByField).length > 0) {
        setValueRowByField((prev) => ({ ...prev, ...result.createdRowsByField }));
      }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  React.useImperativeHandle(ref, () => ({ save }), [entity, recordId, fields, values, valueRowByField, record, onSaved]);

  const fieldsBySection = React.useMemo(() => {
    const map: Record<string, SettingsField[]> = {};
    for (const section of sections) map[section.id] = [];
    for (const field of fields) {
      const sectionId = field.section_id || '__default__';
      if (!map[sectionId]) map[sectionId] = [];
      map[sectionId].push(field);
    }
    for (const key of Object.keys(map)) {
      map[key] = map[key]
        .slice()
        .sort((a, b) => (a.order ?? a.sort_order ?? 0) - (b.order ?? b.sort_order ?? 0));
    }
    return map;
  }, [fields, sections]);

  const sortedSections = React.useMemo(
    () => sections.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter((section) => (fieldsBySection[section.id]?.length ?? 0) > 0),
    [sections, fieldsBySection]
  );

  if (loading) return <div className="text-sm text-text2">Загрузка формы...</div>;

  return (
    <div className="grid gap-4">
      {sortedSections.map((section) => (
        <div key={section.id} className="rounded-card border border-border bg-rowHover p-3">
          <div className="text-sm font-semibold mb-3">{section.title}</div>
          <div className="grid gap-2.5">
            {(fieldsBySection[section.id] ?? []).map((field) => {
              const options = parseFieldOptions(field.options);
              const value = values[field.id] ?? '';
              const label = field.label || field.field_name;
              const required = Boolean(field.required);

              if (field.field_type === 'select') {
                const list = Array.isArray(options.values) ? options.values : [];
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 md:col-span-4 xl:col-span-3 text-xs text-text2">
                      {label}
                      {required ? ' *' : ''}
                    </div>
                    <div className="col-span-12 md:col-span-8 xl:col-span-9">
                      <select
                        className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm"
                        value={String(value ?? '')}
                        onChange={(event) => setFieldValue(field.id, event.target.value)}
                      >
                        <option value="">—</option>
                        {list.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }

              if (field.field_type === 'relation') {
                const list = relationOptions[field.id] || [];
                const labelField = options.labelField || 'name';
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 md:col-span-4 xl:col-span-3 text-xs text-text2">
                      {label}
                      {required ? ' *' : ''}
                    </div>
                    <div className="col-span-12 md:col-span-8 xl:col-span-9">
                      <select
                        className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm"
                        value={String(value ?? '')}
                        onChange={(event) => setFieldValue(field.id, event.target.value)}
                      >
                        <option value="">—</option>
                        {list.map((item) => (
                          <option key={item.id} value={item.id}>
                            {String(item[labelField] ?? item.name ?? item.title ?? item.email ?? item.id)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }

              const inputType: InputType = field.field_type === 'number' ? 'number' : field.field_type === 'email' ? 'email' : field.field_type === 'date' ? 'date' : 'text';
              return (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 md:col-span-4 xl:col-span-3 text-xs text-text2">
                    {label}
                    {required ? ' *' : ''}
                  </div>
                  <div className="col-span-12 md:col-span-8 xl:col-span-9">
                    <Input
                      type={inputType}
                      value={String(value ?? '')}
                      onChange={(event) => setFieldValue(field.id, event.target.value)}
                      placeholder={field.help_text || ''}
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
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  );
}

export const DynamicEntityFormWithRef = React.forwardRef(DynamicEntityForm);
