import React from "react";
import { pb } from "../../../lib/pb";
import { Input } from "../../components/Input";
import { DatePicker } from "../../components/DatePicker";
import { MoneyInput, DecimalInput } from "../../components/MoneyInput";
import { Combobox, type ComboOption } from "../../components/Combobox";
import type { DealFilterParams } from "./dealsFilters";

function safeText(v: string) {
  return v.replace(/\"/g, '\\"');
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-[rgba(255,255,255,0.04)] p-3">
      <div className="text-xs font-bold text-text2 uppercase tracking-wide mb-2">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-text2 mb-1">{label}</div>
      {children}
    </div>
  );
}

export function DealsFilterForm({
  values,
  onChange,
}: {
  values: DealFilterParams;
  onChange: (next: DealFilterParams) => void;
}) {
  const set = (key: keyof DealFilterParams, v: string) => onChange({ ...values, [key]: v });

  const [stage, setStage] = React.useState<ComboOption | null>(null);
  const [owner, setOwner] = React.useState<ComboOption | null>(null);
  const [company, setCompany] = React.useState<ComboOption | null>(null);

  const loadStages = React.useCallback(async (q: string) => {
    const filter = q?.trim() ? `stage_name~"${safeText(q)}"` : "";
    const res = await pb.collection("settings_funnel_stages").getList(1, 30, { filter: filter || undefined, sort: "position" });
    return res.items.map((s) => {
      const r = s as { id: string; stage_name?: string };
      return { value: r.id, label: r.stage_name || "Этап" };
    });
  }, []);

  const loadUsers = React.useCallback(async (q: string) => {
    const filter = q?.trim() ? `full_name~"${safeText(q)}" || email~"${safeText(q)}"` : "";
    const res = await pb.collection("users").getList(1, 30, { filter: filter || undefined, sort: "full_name" });
    return res.items.map((u) => {
      const r = u as { id: string; full_name?: string; email?: string };
      return { value: r.id, label: r.full_name || r.email || "" };
    });
  }, []);

  const loadCompanies = React.useCallback(async (q: string) => {
    const filter = q?.trim() ? `name~"${safeText(q)}"` : "";
    const res = await pb.collection("companies").getList(1, 30, { filter: filter || undefined, sort: "name" });
    return res.items.map((c) => {
      const r = c as { id: string; name?: string };
      return { value: r.id, label: r.name || "Компания" };
    });
  }, []);

  React.useEffect(() => {
    (async () => {
      if (values.stage) {
        const s = (await pb.collection("settings_funnel_stages").getOne(values.stage).catch(() => null)) as { id: string; stage_name?: string } | null;
        setStage(s ? { value: s.id, label: s.stage_name || "Этап" } : null);
      } else setStage(null);
      if (values.owner) {
        const u = (await pb.collection("users").getOne(values.owner).catch(() => null)) as { id: string; full_name?: string; email?: string } | null;
        setOwner(u ? { value: u.id, label: u.full_name || u.email || "" } : null);
      } else setOwner(null);
      if (values.company) {
        const c = (await pb.collection("companies").getOne(values.company).catch(() => null)) as { id: string; name?: string } | null;
        setCompany(c ? { value: c.id, label: c.name || "Компания" } : null);
      } else setCompany(null);
    })();
  }, [values.stage, values.owner, values.company]);

  return (
    <div className="grid gap-3 max-h-[min(70vh,640px)] overflow-y-auto crm-scrollbar pr-2">
      <Section title="Основное">
        <Field label="Название сделки">
          <Input value={values.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Содержит…" />
        </Field>
        <Field label="Компания">
          <Combobox value={company} onChange={(o) => { setCompany(o); set("company", o?.value ?? ""); }} placeholder="Любая" loadOptions={loadCompanies} />
        </Field>
        <Field label="Этап">
          <Combobox value={stage} onChange={(o) => { setStage(o); set("stage", o?.value ?? ""); }} placeholder="Любой" loadOptions={loadStages} />
        </Field>
        <Field label="Ответственный">
          <Combobox value={owner} onChange={(o) => { setOwner(o); set("owner", o?.value ?? ""); }} placeholder="Любой" loadOptions={loadUsers} />
        </Field>
      </Section>

      <Section title="Коммерция">
        <Field label="Канал продаж"><Input value={values.channel ?? ""} onChange={(e) => set("channel", e.target.value)} /></Field>
        <Field label="Партнёр"><Input value={values.partner ?? ""} onChange={(e) => set("partner", e.target.value)} /></Field>
        <Field label="Дистрибьютор"><Input value={values.distributor ?? ""} onChange={(e) => set("distributor", e.target.value)} /></Field>
        <Field label="Формат закупки"><Input value={values.purchase_format ?? ""} onChange={(e) => set("purchase_format", e.target.value)} /></Field>
        <Field label="Тип активности"><Input value={values.activity ?? ""} onChange={(e) => set("activity", e.target.value)} /></Field>
        <Field label="Presale"><Input value={values.presale ?? ""} onChange={(e) => set("presale", e.target.value)} /></Field>
        <Field label="Канал привлечения"><Input value={values.attraction_channel ?? ""} onChange={(e) => set("attraction_channel", e.target.value)} /></Field>
        <Field label="Инфраструктура"><Input value={values.infrastructure_size ?? ""} onChange={(e) => set("infrastructure_size", e.target.value)} /></Field>
      </Section>

      <Section title="Финансы и AI">
        <Field label="Бюджет от"><MoneyInput value={values.budgetMin ?? ""} onChange={(v) => set("budgetMin", v)} placeholder="0" /></Field>
        <Field label="Бюджет до"><MoneyInput value={values.budgetMax ?? ""} onChange={(v) => set("budgetMax", v)} placeholder="без лимита" /></Field>
        <Field label="Оборот от"><MoneyInput value={values.turnoverMin ?? ""} onChange={(v) => set("turnoverMin", v)} /></Field>
        <Field label="Оборот до"><MoneyInput value={values.turnoverMax ?? ""} onChange={(v) => set("turnoverMax", v)} /></Field>
        <Field label="Маржа % от"><DecimalInput value={values.marginMin ?? ""} onChange={(v) => set("marginMin", v)} /></Field>
        <Field label="Маржа % до"><DecimalInput value={values.marginMax ?? ""} onChange={(v) => set("marginMax", v)} /></Field>
        <Field label="Скидка % от"><DecimalInput value={values.discountMin ?? ""} onChange={(v) => set("discountMin", v)} /></Field>
        <Field label="Скидка % до"><DecimalInput value={values.discountMax ?? ""} onChange={(v) => set("discountMax", v)} /></Field>
        <Field label="AI скор от"><DecimalInput value={values.scoreMin ?? ""} onChange={(v) => set("scoreMin", v)} /></Field>
        <Field label="AI скор до"><DecimalInput value={values.scoreMax ?? ""} onChange={(v) => set("scoreMax", v)} /></Field>
        <Field label="Эндпоинты от"><DecimalInput value={values.endpointsMin ?? ""} onChange={(v) => set("endpointsMin", v)} /></Field>
        <Field label="Эндпоинты до"><DecimalInput value={values.endpointsMax ?? ""} onChange={(v) => set("endpointsMax", v)} /></Field>
      </Section>

      <Section title="Даты">
        <Field label="Создано с"><DatePicker value={values.from ?? ""} onChange={(v) => set("from", v)} /></Field>
        <Field label="Создано по"><DatePicker value={values.to ?? ""} onChange={(v) => set("to", v)} /></Field>
        <Field label="Обновлено с"><DatePicker value={values.updatedFrom ?? ""} onChange={(v) => set("updatedFrom", v)} /></Field>
        <Field label="Обновлено по"><DatePicker value={values.updatedTo ?? ""} onChange={(v) => set("updatedTo", v)} /></Field>
        <Field label="Поставка с"><DatePicker value={values.deliveryFrom ?? ""} onChange={(v) => set("deliveryFrom", v)} /></Field>
        <Field label="Поставка по"><DatePicker value={values.deliveryTo ?? ""} onChange={(v) => set("deliveryTo", v)} /></Field>
        <Field label="Ожид. оплата с"><DatePicker value={values.expectedPaymentFrom ?? ""} onChange={(v) => set("expectedPaymentFrom", v)} /></Field>
        <Field label="Ожид. оплата по"><DatePicker value={values.expectedPaymentTo ?? ""} onChange={(v) => set("expectedPaymentTo", v)} /></Field>
        <Field label="Тест с"><DatePicker value={values.testStartFrom ?? ""} onChange={(v) => set("testStartFrom", v)} /></Field>
        <Field label="Тест по"><DatePicker value={values.testEndTo ?? ""} onChange={(v) => set("testEndTo", v)} /></Field>
      </Section>
    </div>
  );
}
