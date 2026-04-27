# CRM New Level v3

Единый репозиторий CRM продукта, server-side автоматизации по клиентам и платформенного AI-контроля.

## Версия

Текущая точка версии: **v3.0.0**  
Эта версия фиксирует:
- self-service регистрацию клиента с ручным approve,
- автопровижининг tenant PocketBase,
- создание первого пользователя клиента,
- платформенный AI control layer в главной БД (`control`).

## Архитектура

### Контуры
- `app.nwlvl.ru` — продукт CRM (frontend).
- `control.nwlvl.ru` — главная platform DB (тенанты, биллинг, AI политика, usage/cost).
- `pb.nwlvl.ru` и `*.nwlvl.ru` — клиентские PocketBase инстансы.
- `cms-api.nwlvl.ru` — отдельный CMS-контур (не связан с tenant CRM данными).

### Репозиторий
- `apps/web` — frontend CRM (React + Vite + TS + Tailwind).
- `backend/pocketbase` — исходный шаблон схемы коллекций.
- `backend/platform-console` — внешняя owner/founder web-оболочка для AI управления.
- `db/postgres` — альтернативная SQL схема (future path).

## Основные потоки

### 1) Регистрация и выдача нового кабинета
- Клиент отправляет заявку через `/register`.
- Заявка сохраняется в `control` (`tenant_registrations`) со статусом `new`.
- Только после ручного approve заявка обрабатывается.
- Система поднимает новый tenant PB (`pb-tenant-<slug>`), настраивает домен/прокси, создает первого пользователя.

### 2) Платформенный AI контроль
- Глобальные AI настройки хранятся в `control.system_settings` (`group_name='ai'`).
- Включение/выключение AI модулей по клиентам хранится в `control.tenant_modules`.
- Usage/cost — в `ai_usage_daily` и `ai_usage_monthly`.

## Локальный запуск (dev)

### PocketBase
PocketBase бинарник в репо не хранится. Положите бинарник в `backend/pocketbase/pb`.

```bash
cd backend/pocketbase
./init.sh
./run.sh
```

### Frontend
```bash
cd apps/web
cp .env.example .env
npm i
npm run dev
```

Windows PowerShell:
```powershell
cd apps/web
Copy-Item .env.example .env
npm i
npm run dev
```

По умолчанию frontend использует `VITE_PB_URL=/api`, а Vite проксирует в `http://127.0.0.1:8090`.

## Серверные автоматизации (production)

### Регистрации / провижининг
- Скрипт обработки регистраций: `/opt/pb-control/process-tenant-registrations.py`
- Таймер: `pb-registration-processor.timer`
- Провижининг tenant: `/opt/pb-control/provision-tenant.sh`

### Платформенный AI контроль
- Инициализация AI слоя: `/opt/pb-control/bootstrap-ai-control.py`
- CLI управления модулем клиента:
```bash
python3 /opt/pb-control/manage-tenant-ai-access.py \
  --tenant tenant-test12345 \
  --module ai_research_engine \
  --enabled 0 \
  --limit 0
```
- Cost/usage dashboard:
```bash
python3 /opt/pb-control/ai-cost-dashboard.py
```

### Founder web console
- Код: `backend/platform-console/server.py`
- systemd unit template: `backend/platform-console/platform-console.service`
- Endpoint: `https://control.nwlvl.ru/owner/` (через nginx proxy на сервис platform-console).
- Авторизация founder-console:
  - `PLATFORM_CONSOLE_USER`
  - `PLATFORM_CONSOLE_PASSWORD`
  - `PLATFORM_CONSOLE_SESSION_TTL_HOURS`
- Серверные AI ключи (не во frontend):
  - `PLATFORM_AI_SECRETS_FILE` (JSON-файл с правами `600`)
  - в web-консоли `/owner/` доступен блок сохранения ключей + тест провайдера
- В `/owner/` добавлена матрица маршрутизации:
  - `task -> primary/fallback provider+engine -> token source -> request/token limits -> default price`
  - хранится в `system_settings` ключом `ai.routing.matrix`
- Public AI gateway endpoint для CRM:
  - `POST /owner/api/public/ai/analyze-deal`
  - записывает результат в tenant PocketBase: `ai_insights`, `timeline`, `deals.current_score/current_recommendations`
  - frontend env: `VITE_AI_GATEWAY_URL`
  - поддержка `gigachat` (OAuth + chat completions), а также OpenAI-compatible провайдеров (`deepseek`, `qwen`, `openai`, ...)

## AI, парсеры и продажи

В рамках v3 заложен каркас для 4 направлений:
- анализ сделки (вероятность, риски, next steps),
- decision support (боли, ценность, сценарий дожима),
- research engine (обогащение + фильтрация результатов парсеров),
- конкурентная отстройка.

Управление включением по клиентам идет только из `control`, не из tenant CRM UI.

## Безопасность

- Секреты и токены парсеров/AI не хранятся во фронте.
- Критичные платформенные операции — только через `control` и серверный слой.
- Публичная регистрация ограничена anti-fraud гейтом (manual approve).

## Git release policy

Для мажорной фиксации версии:
1. Коммит с итоговыми изменениями.
2. Тег версии:
   - `v3.0.0` (major release point).
3. Push ветки и тега в origin.
