import React from "react";
import { pb } from "../../../lib/pb";
import { Input } from "../../components/Input";
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
    <div className="grid gap-3 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
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
        <Field label="Бюджет от"><Input type="number" value={values.budgetMin ?? ""} onChange={(e) => set("budgetMin", e.target.value)} /></Field>
        <Field label="Бюджет до"><Input type="number" value={values.budgetMax ?? ""} onChange={(e) => set("budgetMax", e.target.value)} /></Field>
        <Field label="Оборот от"><Input type="number" value={values.turnoverMin ?? ""} onChange={(e) => set("turnoverMin", e.target.value)} /></Field>
        <Field label="Оборот до"><Input type="number" value={values.turnoverMax ?? ""} onChange={(e) => set("turnoverMax", e.target.value)} /></Field>
        <Field label="Маржа % от"><Input type="number" value={values.marginMin ?? ""} onChange={(e) => set("marginMin", e.target.value)} /></Field>
        <Field label="Маржа % до"><Input type="number" value={values.marginMax ?? ""} onChange={(e) => set("marginMax", e.target.value)} /></Field>
        <Field label="Скидка % от"><Input type="number" value={values.discountMin ?? ""} onChange={(e) => set("discountMin", e.target.value)} /></Field>
        <Field label="Скидка % до"><Input type="number" value={values.discountMax ?? ""} onChange={(e) => set("discountMax", e.target.value)} /></Field>
        <Field label="AI скор от"><Input type="number" value={values.scoreMin ?? ""} onChange={(e) => set("scoreMin", e.target.value)} /></Field>
        <Field label="AI скор до"><Input type="number" value={values.scoreMax ?? ""} onChange={(e) => set("scoreMax", e.target.value)} /></Field>
        <Field label="Эндпоинты от"><Input type="number" value={values.endpointsMin ?? ""} onChange={(e) => set("endpointsMin", e.target.value)} /></Field>
        <Field label="Эндпоинты до"><Input type="number" value={values.endpointsMax ?? ""} onChange={(e) => set("endpointsMax", e.target.value)} /></Field>
      </Section>

      <Section title="Даты">
        <Field label="Создано с"><Input type="date" value={values.from ?? ""} onChange={(e) => set("from", e.target.value)} /></Field>
        <Field label="Создано по"><Input type="date" value={values.to ?? ""} onChange={(e) => set("to", e.target.value)} /></Field>
        <Field label="Обновлено с"><Input type="date" value={values.updatedFrom ?? ""} onChange={(e) => set("updatedFrom", e.target.value)} /></Field>
        <Field label="Обновлено по"><Input type="date" value={values.updatedTo ?? ""} onChange={(e) => set("updatedTo", e.target.value)} /></Field>
        <Field label="Поставка с"><Input type="date" value={values.deliveryFrom ?? ""} onChange={(e) => set("deliveryFrom", e.target.value)} /></Field>
        <Field label="Поставка по"><Input type="date" value={values.deliveryTo ?? ""} onChange={(e) => set("deliveryTo", e.target.value)} /></Field>
        <Field label="Ожид. оплата с"><Input type="date" value={values.expectedPaymentFrom ?? ""} onChange={(e) => set("expectedPaymentFrom", e.target.value)} /></Field>
        <Field label="Ожид. оплата по"><Input type="date" value={values.expectedPaymentTo ?? ""} onChange={(e) => set("expectedPaymentTo", e.target.value)} /></Field>
        <Field label="Тест с"><Input type="date" value={values.testStartFrom ?? ""} onChange={(e) => set("testStartFrom", e.target.value)} /></Field>
        <Field label="Тест по"><Input type="date" value={values.testEndTo ?? ""} onChange={(e) => set("testEndTo", e.target.value)} /></Field>
      </Section>
    </div>
  );
}
