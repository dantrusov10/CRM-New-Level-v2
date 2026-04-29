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
import { InlineConfirmActions } from './InlineConfirmActions';

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
  const [initialValues, setInitialValues] = React.useState<Record<string, unknown>>({});
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
    setInitialValues(nextValues);

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

  function isFieldDirty(fieldId: string) {
    const current = values[fieldId];
    const initial = initialValues[fieldId];
    return String(current ?? '') !== String(initial ?? '');
  }

  async function saveField(field: SettingsField) {
    if (!recordId || saving) return;
    setSaving(true);
    try {
      const result = await saveEntityFormData({
        entity,
        recordId,
        record,
        fields: [field],
        values: { [field.id]: values[field.id] ?? '' },
        valueRowByField,
      });
      if (Object.keys(result.createdRowsByField).length > 0) {
        setValueRowByField((prev) => ({ ...prev, ...result.createdRowsByField }));
      }
      setInitialValues((prev) => ({ ...prev, [field.id]: values[field.id] ?? '' }));
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  function resetField(fieldId: string) {
    setValues((prev) => ({ ...prev, [fieldId]: initialValues[fieldId] ?? '' }));
  }

  function FieldActions({ field }: { field: SettingsField }) {
    if (!isFieldDirty(field.id)) return null;
    return (
      <InlineConfirmActions
        onConfirm={() => void saveField(field)}
        onCancel={() => resetField(field.id)}
        disabled={saving}
        size="lg"
      />
    );
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
    <div className="grid gap-3">
      {sortedSections.map((section) => (
        <section key={section.id} className="board-shell neon-accent p-2.5">
          <div className="mb-2 flex items-center gap-2 border-b border-border/70 pb-2">
            <span className="neon-pill">{section.title}</span>
          </div>
          <div className="grid gap-2">
            {(fieldsBySection[section.id] ?? []).map((field) => {
              const options = parseFieldOptions(field.options);
              const value = values[field.id] ?? '';
              const label = field.label || field.field_name;
              const required = Boolean(field.required);

              if (field.field_type === 'select') {
                const list = Array.isArray(options.values) ? options.values : [];
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center rounded-md bg-[rgba(255,255,255,0.03)] p-1.5">
                    <div className="col-span-12 md:col-span-4 xl:col-span-3 text-xs text-text2">
                      {label}
                      {required ? ' *' : ''}
                    </div>
                    <div className="col-span-12 md:col-span-8 xl:col-span-9">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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
                        <FieldActions field={field} />
                      </div>
                    </div>
                  </div>
                );
              }

              if (field.field_type === 'relation') {
                const list = relationOptions[field.id] || [];
                const labelField = options.labelField || 'name';
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center rounded-md bg-[rgba(255,255,255,0.03)] p-1.5">
                    <div className="col-span-12 md:col-span-4 xl:col-span-3 text-xs text-text2">
                      {label}
                      {required ? ' *' : ''}
                    </div>
                    <div className="col-span-12 md:col-span-8 xl:col-span-9">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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
                        <FieldActions field={field} />
                      </div>
                    </div>
                  </div>
                );
              }

              const inputType: InputType = field.field_type === 'number' ? 'number' : field.field_type === 'email' ? 'email' : field.field_type === 'date' ? 'date' : 'text';
              return (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center rounded-md bg-[rgba(255,255,255,0.03)] p-1.5">
                  <div className="col-span-12 md:col-span-4 xl:col-span-3 text-xs text-text2">
                    {label}
                    {required ? ' *' : ''}
                  </div>
                  <div className="col-span-12 md:col-span-8 xl:col-span-9">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <Input
                        type={inputType}
                        value={String(value ?? '')}
                        onChange={(event) => setFieldValue(field.id, event.target.value)}
                        placeholder={field.help_text || ''}
                      />
                      <FieldActions field={field} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export const DynamicEntityFormWithRef = React.forwardRef(DynamicEntityForm);
