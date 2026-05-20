import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import type { Deal } from "../../../lib/types";
import { dealBudget, dealTurnover } from "./dealNumeric";

export type DealColumnMeta = {
  id: string;
  label: string;
  group: "основное" | "финансы" | "коммерция" | "даты" | "ai" | "ссылки";
  defaultVisible?: boolean;
};

export const DEAL_COLUMN_META: DealColumnMeta[] = [
  { id: "title", label: "Сделка", group: "основное", defaultVisible: true },
  { id: "company", label: "Компания", group: "основное", defaultVisible: true },
  { id: "owner", label: "Ответственный", group: "основное", defaultVisible: true },
  { id: "stage", label: "Этап", group: "основное", defaultVisible: true },
  { id: "budget", label: "Бюджет", group: "финансы", defaultVisible: true },
  { id: "turnover", label: "Оборот", group: "финансы", defaultVisible: true },
  { id: "margin_percent", label: "Маржа %", group: "финансы", defaultVisible: true },
  { id: "discount_percent", label: "Скидка %", group: "финансы" },
  { id: "sales_channel", label: "Канал", group: "коммерция", defaultVisible: true },
  { id: "partner", label: "Партнёр", group: "коммерция" },
  { id: "distributor", label: "Дистрибьютор", group: "коммерция" },
  { id: "purchase_format", label: "Формат закупки", group: "коммерция" },
  { id: "activity_type", label: "Тип активности", group: "коммерция" },
  { id: "endpoints", label: "Эндпоинты", group: "коммерция" },
  { id: "infrastructure_size", label: "Инфраструктура", group: "коммерция" },
  { id: "attraction_channel", label: "Канал привлечения", group: "коммерция" },
  { id: "current_score", label: "AI скор", group: "ai" },
  { id: "created", label: "Создано", group: "даты" },
  { id: "updated", label: "Обновлено", group: "даты", defaultVisible: true },
  { id: "delivery_date", label: "Поставка", group: "даты" },
  { id: "expected_payment_date", label: "Ожид. оплата", group: "даты" },
  { id: "project_map_link", label: "Карта проекта", group: "ссылки" },
  { id: "kaiten_link", label: "Kaiten", group: "ссылки" },
];

export const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  DEAL_COLUMN_META.map((c) => [c.id, Boolean(c.defaultVisible)])
);

function cellText(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function numCell(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") : "—";
}

export function buildDealColumns(): ColumnDef<Deal, unknown>[] {
  const defs: Record<string, ColumnDef<Deal, unknown>> = {
    title: {
      id: "title",
      accessorKey: "title",
      header: "Сделка",
      size: 220,
      minSize: 140,
      cell: (info) => <span className="font-medium">{String(info.getValue() ?? "")}</span>,
    },
    company: {
      id: "company",
      accessorFn: (d) => d.expand?.company_id?.name ?? "—",
      header: "Компания",
      size: 160,
      cell: (info) => <span className="text-text2">{String(info.getValue())}</span>,
    },
    owner: {
      id: "owner",
      accessorFn: (d) => d.expand?.responsible_id?.full_name ?? d.expand?.responsible_id?.email ?? "—",
      header: "Ответственный",
      size: 150,
      cell: (info) => <span className="text-text2">{String(info.getValue())}</span>,
    },
    stage: {
      id: "stage",
      header: "Этап",
      size: 140,
      cell: ({ row }) => {
        const d = row.original;
        return (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: d.expand?.stage_id?.color ?? "#9CA3AF" }} />
            <span className="text-text2">{d.expand?.stage_id?.stage_name ?? "—"}</span>
          </span>
        );
      },
    },
    budget: {
      id: "budget",
      accessorFn: (d) => dealBudget(d),
      header: "Бюджет",
      size: 110,
      cell: (i) => <span className="tabular-nums">{numCell(i.getValue())}</span>,
    },
    turnover: {
      id: "turnover",
      accessorFn: (d) => dealTurnover(d),
      header: "Оборот",
      size: 110,
      cell: (i) => <span className="tabular-nums">{numCell(i.getValue())}</span>,
    },
    margin_percent: { id: "margin_percent", accessorKey: "margin_percent", header: "Маржа %", size: 90, cell: (i) => <span className="tabular-nums">{typeof i.getValue() === "number" ? `${i.getValue()}%` : "—"}</span> },
    discount_percent: { id: "discount_percent", accessorKey: "discount_percent", header: "Скидка %", size: 90, cell: (i) => <span className="tabular-nums">{typeof i.getValue() === "number" ? `${i.getValue()}%` : "—"}</span> },
    sales_channel: { id: "sales_channel", accessorKey: "sales_channel", header: "Канал", size: 120, cell: (i) => <span className="text-text2">{cellText(i.getValue())}</span> },
    partner: { id: "partner", accessorKey: "partner", header: "Партнёр", size: 120, cell: (i) => <span className="text-text2">{cellText(i.getValue())}</span> },
    distributor: { id: "distributor", accessorKey: "distributor", header: "Дистрибьютор", size: 120, cell: (i) => <span className="text-text2">{cellText(i.getValue())}</span> },
    purchase_format: { id: "purchase_format", accessorKey: "purchase_format", header: "Формат закупки", size: 130, cell: (i) => <span className="text-text2">{cellText(i.getValue())}</span> },
    activity_type: { id: "activity_type", accessorKey: "activity_type", header: "Тип активности", size: 130, cell: (i) => <span className="text-text2">{cellText(i.getValue())}</span> },
    endpoints: { id: "endpoints", accessorKey: "endpoints", header: "Эндпоинты", size: 90, cell: (i) => <span className="tabular-nums">{cellText(i.getValue())}</span> },
    infrastructure_size: { id: "infrastructure_size", accessorKey: "infrastructure_size", header: "Инфраструктура", size: 130, cell: (i) => <span className="text-text2">{cellText(i.getValue())}</span> },
    attraction_channel: { id: "attraction_channel", accessorKey: "attraction_channel", header: "Канал привлечения", size: 140, cell: (i) => <span className="text-text2">{cellText(i.getValue())}</span> },
    current_score: { id: "current_score", accessorKey: "current_score", header: "AI скор", size: 80, cell: (i) => <span className="tabular-nums font-semibold">{cellText(i.getValue())}</span> },
    created: { id: "created", accessorKey: "created", header: "Создано", size: 140, cell: (i) => <span className="text-text2">{i.getValue() ? dayjs(String(i.getValue())).format("DD.MM.YY HH:mm") : "—"}</span> },
    updated: { id: "updated", accessorKey: "updated", header: "Обновлено", size: 140, cell: (i) => <span className="text-text2">{i.getValue() ? dayjs(String(i.getValue())).format("DD.MM.YY HH:mm") : "—"}</span> },
    delivery_date: { id: "delivery_date", accessorKey: "delivery_date", header: "Поставка", size: 120, cell: (i) => <span className="text-text2">{i.getValue() ? dayjs(String(i.getValue())).format("DD.MM.YYYY") : "—"}</span> },
    expected_payment_date: { id: "expected_payment_date", accessorKey: "expected_payment_date", header: "Ожид. оплата", size: 120, cell: (i) => <span className="text-text2">{i.getValue() ? dayjs(String(i.getValue())).format("DD.MM.YYYY") : "—"}</span> },
    project_map_link: { id: "project_map_link", accessorKey: "project_map_link", header: "Карта", size: 80, cell: (i) => (i.getValue() ? <span className="text-primary text-xs">ссылка</span> : "—") },
    kaiten_link: { id: "kaiten_link", accessorKey: "kaiten_link", header: "Kaiten", size: 80, cell: (i) => (i.getValue() ? <span className="text-primary text-xs">ссылка</span> : "—") },
  };

  return DEAL_COLUMN_META.map((m) => defs[m.id]).filter(Boolean);
}
