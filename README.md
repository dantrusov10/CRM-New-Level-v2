# CRM «Решение» — репозиторий (MVP / internal)

Этот репозиторий собран **строго по вложенным материалам**:
- ТЗ/паспорт функционала
- Design System
- PocketBase collections (v2 auth patch)
- Postgres schema (для альтернативного бэкенда / future-proof)

## Состав
- `apps/web` — фронтенд (React + Vite + TS + Tailwind) с готовым UI/UX
- `backend/pocketbase` — конфиг и импорт коллекций PocketBase
- `db/postgres` — SQL схема (если решите уехать на Postgres)

---

## Быстрый старт (локально)

### 1) PocketBase
> PocketBase бинарник в репозитории **не хранится** (его лучше скачивать под свою ОС).
1. Скачайте PocketBase с официального GitHub релиза (под вашу OS/arch).
2. Положите бинарник в `backend/pocketbase/pb` (или добавьте в PATH как `pocketbase`).

Инициализация:
```bash
cd backend/pocketbase
# создаст data/ и применит коллекции из json
./init.sh
# запуск
./run.sh
```

PocketBase будет доступен на:
- Admin UI: http://127.0.0.1:8090/_/
- API: http://127.0.0.1:8090/api/

### 2) Frontend
```bash
cd apps/web
npm i
npm run dev
```
Web будет доступен на http://127.0.0.1:5173

### 3) Переменные окружения
Фронтенд читает:
- `VITE_PB_URL` (по умолчанию `http://127.0.0.1:8090`)

---

## Основные разделы UI
- Сделки: **таблица** + **канбан** + **карточка сделки** (timeline + AI insights)
- Компании: список + карточка компании (связанные сделки/контакты/файлы)
- Импорт/Экспорт (CSV)
- Поиск/Фильтры + сохранённые фильтры
- Админка:
  - Пользователи и роли (матрица доступов)
  - Воронка (этапы)
  - Конструктор полей карточек
  - Настройка парсеров: контакты / медиа / тендеры
  - Настройка калькулятора КП (каркас + сущности)

---

## Примечания по правам (RBAC)
В PocketBase используется:
- auth коллекция `users`
- прикладные настройки `settings_roles`
- матрица доступов хранится как JSON в роли

Во фронте:
- скрытие UI-экшенов по правам
- server-side контроль обеспечивается rules PocketBase (при необходимости можно усилить)

---

## Деплой (минимально)
- PocketBase: любой VM/контейнер в РФ-облаке (Yandex Cloud / Selectel / Timeweb Cloud)
- Frontend: static hosting (S3-like) или nginx.

## Local development: PocketBase API (no CORS issues)

PocketBase Admin UI doesn't provide CORS settings.  
To make local development work without CORS, the web app uses a Vite proxy:

- Frontend calls `VITE_PB_URL=/api` (default)
- Vite proxies `/api/*` → `http://127.0.0.1:8090/*` (PocketBase)

### Run PocketBase

```bash
cd backend/pocketbase
# place PocketBase binary here as ./pb (chmod +x)
./init.sh
./run.sh
```

### Run Web

```bash
cd apps/web
cp .env.example .env
npm i
npm run dev
```

Now open the web app on http://localhost:5173 — API requests go through `/api` and bypass CORS.
