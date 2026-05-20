# Автовыгрузка на почту (crm@nwlvl.ru)

## Как работает

1. **В браузере** (вкладка CRM открыта): расписание из «Автовыгрузка» → файл → `POST /api/send-export-email` → письмо с вложением.
2. **На сервере** (Vercel cron 06:00 UTC): задачи из PocketBase `export_jobs` → xlsx → почта. Срабатывают задания с **часом 6 и минутой 0** (подстройте расписание в UI или используйте внешний cron для других часов).

Задачи синхронизируются в PB при сохранении в модалке «Автовыгрузка».

## Шаг 1 — коллекция PocketBase

Импортируйте обновлённый `backend/pocketbase/pb_schema.json` (коллекция **export_jobs**) или создайте вручную в админке PB.

## Шаг 2 — почта crm@nwlvl.ru на Vercel

### Вариант A — Resend (рекомендуется)

1. https://resend.com → добавьте домен **nwlvl.ru** (DNS TXT/MX по инструкции).
2. После верификации можно слать с `crm@nwlvl.ru`.
3. В Vercel → **crm-new-level-v2** → Environment Variables:

| Переменная | Значение |
|------------|----------|
| `RESEND_API_KEY` | `re_...` |
| `MAIL_FROM` | `crm@nwlvl.ru` |
| `POCKETBASE_URL` | `https://app.nwlvl.ru/api` |
| `POCKETBASE_SERVICE_TOKEN` | JWT админа PB (см. ниже) |
| `CRON_SECRET` | случайная строка (для cron) |

### Вариант B — SMTP хостинга домена

| Переменная | Пример |
|------------|--------|
| `SMTP_HOST` | `smtp.mail.ru` / `smtp.yandex.ru` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `crm@nwlvl.ru` |
| `SMTP_PASS` | пароль ящика |
| `SMTP_SECURE` | `true` |
| `MAIL_FROM` | `crm@nwlvl.ru` |

## POCKETBASE_SERVICE_TOKEN

1. Войдите в CRM как **admin**.
2. DevTools → Application → PocketBase auth token, или создайте долгоживущий токен через PB admin.
3. Вставьте в Vercel как `POCKETBASE_SERVICE_TOKEN` (только server, без `VITE_`).

## Опционально

| Переменная | Назначение |
|------------|------------|
| `VITE_AUTO_EXPORT_WEBHOOK` | Переопределить URL (по умолчанию `/api/send-export-email` на том же домене) |

После env — **Redeploy** production.

## Проверка

```bash
# Письмо (нужен Authorization: <ваш PB user token>)
curl -X POST https://app.nwlvl.ru/api/send-export-email \
  -H "Authorization: YOUR_PB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"you@company.ru","filename":"test.txt","contentBase64":"dGVzdA=="}'
```

## Ограничение Hobby

Только **2 cron в сутки** (monitor 07:00, export 06:00 UTC). Для выгрузки в 09:00 без открытой вкладки — тариф Pro или внешний ping `https://app.nwlvl.ru/api/cron-run-exports` с заголовком `Authorization: Bearer CRON_SECRET`.
