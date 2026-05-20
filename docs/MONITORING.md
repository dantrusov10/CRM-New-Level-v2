# Мониторинг (Vercel + Telegram)

## Endpoint

`GET /api/monitor-health` — serverless-функция в `apps/web/api/monitor-health.ts`.

Проверяет:

- фронт CRM (`MONITOR_APP_URL`, по умолчанию `https://app.nwlvl.ru`);
- PocketBase (`MONITOR_PB_URL`, по умолчанию `{APP}/api/health`);
- AI Gateway (`MONITOR_AI_URL`, по умолчанию `https://control.nwlvl.ru/owner/api/public/health`).

При ошибке любого target отправляет сообщение в Telegram (если заданы токены).

## Cron (Vercel)

В `apps/web/vercel.json` настроен запуск каждые **10 минут**.

## Переменные окружения (Vercel → Project → Settings → Environment Variables)

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен бота [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | ID чата/группы для алертов |
| `CRON_SECRET` | (опционально) Bearer-токен для защиты cron-вызовов |
| `MONITOR_APP_URL` | URL SPA |
| `MONITOR_PB_URL` | URL health PocketBase |
| `MONITOR_AI_URL` | URL health AI Gateway |

## Ручная проверка

```bash
curl -s https://app.nwlvl.ru/api/monitor-health
```

С `CRON_SECRET`:

```bash
curl -s -H "Authorization: Bearer YOUR_SECRET" https://app.nwlvl.ru/api/monitor-health
```
