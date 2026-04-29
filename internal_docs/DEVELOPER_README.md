# DEVELOPER README (пошагово)

## 0. Что нужно заранее
- Node.js 18+.
- npm.
- PocketBase binary (скачать отдельно).
- Git.

## 1. Клонировать и перейти в проект
```bash
git clone <repo_url>
cd CRM-New-Level-v2-main
```

## 2. Подготовить PocketBase
1. Скачайте PocketBase под вашу ОС.
2. Положите бинарник как:
   - `backend/pocketbase/pb`
3. Сделайте исполняемым (Linux/macOS):
```bash
chmod +x backend/pocketbase/pb
```

## 3. Инициализировать схему PocketBase
```bash
cd backend/pocketbase
./init.sh
```

Если видите сообщение про отсутствующий бинарник — проверьте путь к `pb`.

## 4. Запустить PocketBase
```bash
cd backend/pocketbase
./run.sh
```

Ожидаемо:
- Admin UI: `http://127.0.0.1:8090/_/`
- API: `http://127.0.0.1:8090/api/`

## 5. Запустить frontend
```bash
cd apps/web
npm i
npm run dev
```

Ожидаемо:
- Web: `http://127.0.0.1:5173`

## 6. ENV (что нужно)
- Подтверждено кодом:
  - `VITE_PB_URL`
- По умолчанию используется `/api`, а Vite проксирует на `127.0.0.1:8090`.

Пример `.env`:
```env
VITE_PB_URL=/api
```

## 7. Проверить, что фронт видит БД
1. Откройте приложение в браузере.
2. Попробуйте логин.
3. Проверьте загрузку списков компаний/сделок.
4. Если пусто/ошибка:
   - Проверьте, что PocketBase запущен.
   - Проверьте `VITE_PB_URL`.
   - Проверьте proxy в `vite.config.ts`.

## 8. Команды npm
```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
```

## 9. Как импортировать схему PocketBase вручную
Если нужно переинициализировать:
```bash
cd backend/pocketbase
./pb migrate collections import ./collections.json --dir ./pb_data
```

## 10. Как собрать проект
```bash
cd apps/web
npm run build
```
Build будет в `apps/web/dist`.

## 11. Как деплоить (AS IS)
- Frontend: через Vercel (по `vercel.json`).
- PocketBase: отдельный деплой на сервер/VM.
- В этом репо нет готового скрипта полного production deployment pipeline.

## 12. Частые ошибки
- **PocketBase binary not found**  
  Проверьте `backend/pocketbase/pb`.
- **CORS/API ошибка в dev**  
  Проверьте proxy в Vite и `VITE_PB_URL`.
- **Коллекция не найдена**  
  Вероятно схема не импортирована или версия схемы отличается.
- **UI ожидает коллекцию, которой нет**  
  Сверьте `collections.json` и вызовы во фронте (особенно KPI/КП модуль).

## 13. Куда смотреть при проблемах
- Данные/запросы: `apps/web/src/ui/data/hooks.ts`
- Роутинг: `apps/web/src/router.tsx`
- PocketBase schema: `backend/pocketbase/collections.json`
- Админ-парсеры: `apps/web/src/ui/pages/admin/AdminParsersPage.tsx`
- КП: `apps/web/src/ui/modules/kp/*`
