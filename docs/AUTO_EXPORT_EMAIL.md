# Автовыгрузка на почту (crm@nwlvl.ru)

## Как работает

1. **В браузере** (вкладка CRM открыта): расписание из «Автовыгрузка» → файл → webhook `send-export-email` → письмо с вложением.
2. **На сервере** (`control.nwlvl.ru`): тот же endpoint через SMTP (по умолчанию Selectel).
3. **Vercel cron** (06:00 UTC): задачи из PocketBase `export_jobs` → xlsx → почта (задания с часом 6 и минутой 0).

Задачи синхронизируются в PB при сохранении в модалке «Автовыгрузка».

## Рекомендуется: Selectel Email Service

Домен `nwlvl.ru` уже на DNS Selectel. Почтовый сервис позволяет отправлять с **любого адреса на домене** (например `crm@nwlvl.ru`) без отдельного ящика.

### Автонастройка (на VPS)

1. IAM-токен проекта → `/opt/pb-control/.selectel_iam_token` (chmod 600).
2. `python3 /opt/pb-control/setup_selectel_email.py`
3. DKIM из панели → `python3 .../setup_selectel_email.py --dkim '...'`
4. `bash /opt/pb-control/apply_selectel_smtp.sh`

Подробно: `tools/setup_selectel_email.py`, инструкция на рабочем столе `CRM-Автоэкспорт-Selectel-почта.txt`.

SMTP: `smtp.mail.selcloud.ru`, порт **1127** (TLS), логин/пароль — в панели [Почтовый сервис](https://my.selectel.ru/ses/).

### Vercel (резерв / cron)

| Переменная | Значение |
|------------|----------|
| `SMTP_HOST` | `smtp.mail.selcloud.ru` |
| `SMTP_PORT` | `1127` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | login из Selectel SES |
| `SMTP_PASS` | password из Selectel SES |
| `MAIL_FROM` | `NewLevel CRM <crm@nwlvl.ru>` |
| `POCKETBASE_URL` | `https://pb.nwlvl.ru` |
| `POCKETBASE_SERVICE_TOKEN` | JWT сервисного пользователя PB |
| `CRON_SECRET` | случайная строка |

После env — **Redeploy** production.

### Альтернатива: Resend / Yandex

- **Resend:** `RESEND_API_KEY` + верификация домена.
- **Yandex:** только **пароль приложения** для SMTP (не обычный пароль аккаунта).

## POCKETBASE_SERVICE_TOKEN

Сервисный пользователь `crm-export@nwlvl.ru` — токен в `/opt/pb-control/.crm_service_token` на сервере.

## Проверка

```bash
# С сервера
TEST_EMAIL=<admin@...> TEST_PASSWORD=... python3 /opt/pb-control/test_export_email_remote.py
```

## Ограничение Hobby (Vercel)

Не больше **2 cron в сутки**. Для выгрузки в другое время — открытая вкладка CRM или внешний ping `https://app.nwlvl.ru/api/cron-run-exports` с `Authorization: Bearer CRON_SECRET`.
