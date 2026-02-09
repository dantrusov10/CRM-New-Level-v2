import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useCompany, useDeals, useTimeline } from "../../data/hooks";
import { Button } from "../../components/Button";
import dayjs from "dayjs";
import { DynamicEntityFormWithRef, DynamicEntityFormHandle } from "../../components/DynamicEntityForm";

export function CompanyDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const companyQ = useCompany(id!);
  const dealsQ = useDeals({ filter: `company_id="${id}"` });
  const tlQ = useTimeline("company", id!);

  const c = companyQ.data as any;
  const formRef = React.useRef<DynamicEntityFormHandle | null>(null);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Карточка компании</div>
              <div className="text-xs text-text2 mt-1">Основные данные + юр.инфо + связи (по ТЗ)</div>
            </div>
            <Button variant="secondary" onClick={() => nav("/deals")}>К сделкам</Button>
          </div>
        </CardHeader>
        <CardContent>
          {companyQ.isLoading ? (
            <div className="text-sm text-text2">Загрузка...</div>
          ) : (
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold">{c?.name}</div>
                  <div className="text-sm text-text2 mt-1">ID: {c?.id}</div>
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await formRef.current?.save();
                    await companyQ.refetch();
                  }}
                >
                  Сохранить
                </Button>
              </div>

              <DynamicEntityFormWithRef
                ref={formRef}
                entity="company"
                record={c}
                onSaved={async () => {
                  await companyQ.refetch();
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Связанные сделки</div>
          </CardHeader>
          <CardContent>
            {dealsQ.isLoading ? (
              <div className="text-sm text-text2">Загрузка...</div>
            ) : (
              <div className="grid gap-2">
                {(dealsQ.data ?? []).map((d: any) => (
                  <button key={d.id} className="text-left rounded-card border border-border bg-white hover:bg-rowHover px-3 py-2" onClick={() => nav(`/deals/${d.id}`)}>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-text2 mt-1">{d.expand?.stage_id?.stage_name ?? "—"}</div>
                  </button>
                ))}
                {!dealsQ.data?.length ? <div className="text-sm text-text2">Сделок пока нет.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">История активности</div>
          </CardHeader>
          <CardContent>
            {tlQ.isLoading ? (
              <div className="text-sm text-text2">Загрузка...</div>
            ) : (
              <div className="grid gap-3">
                {(tlQ.data ?? []).map((t: any) => (
                  <div key={t.id} className="border-b border-border pb-2">
                    <div className="text-xs text-text2">{dayjs(t.created).format("DD.MM.YYYY HH:mm")}</div>
                    <div className="text-sm">{t.comment || t.action}</div>
                  </div>
                ))}
                {!tlQ.data?.length ? <div className="text-sm text-text2">Событий пока нет.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
