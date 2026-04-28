# AGENT_CONTEXT — CRM NewLevel (операционный старт)

Этот файл нужен для быстрого старта нового агента: где реальный репозиторий, как подключаться к серверу, что деплоится автоматически, а что вручную.

Обязательно читать вместе с `README.md` в актуальном рабочем репозитории.

---

## 1) Где работать (источник истины)

Есть два локальных каталога, но рабочим для прода считать **только один**:

- **PRIMARY (использовать по умолчанию):**  
  `C:\Users\Данила\Documents\GitHub\CRM-New-Level-v2`
- Secondary/архивная копия:  
  `C:\Users\Данила\Desktop\CRM-New-Level-v2-main\v0\CRM-New-Level-v2-main`

Правило:

1. Сначала проверить, где есть актуальная история коммитов и `origin`.
2. Если не оговорено отдельно, все изменения делать в PRIMARY.
3. Перед началом проверить `git status` и `git remote -v`.

---

## 2) Git / GitHub

- Production remote: `https://github.com/dantrusov10/CRM-New-Level-v2.git`
- Основная ветка: `main`
- Пуш в `main` запускает frontend автодеплой (Vercel).
- Для GitHub операций можно использовать `git`, `gh` (если требуется).

Важно:

- Vercel деплоит только frontend.
- Backend gateway (`platform-console`) не обновляется от Vercel автоматически.

---

## 3) SSH и сервер

Проверенный сервер:

- Host: `2.58.69.58`
- User: `root`
- Key: `C:\Users\Данила\.ssh\id_ed25519`

Подключение (использовать прямую команду, т.к. alias может отсутствовать):

```powershell
ssh -o BatchMode=yes root@2.58.69.58 "echo connected && hostname && whoami"
```

### Что сейчас крутится на сервере

- `platform-console.service` — AI control + public AI gateway.
- `pb-control.service`, `pocketbase.service`, `pb-tenant-*` — tenant и control контуры.
- Рабочая директория control plane: `/opt/pb-control`
- Путь gateway-кода: `/opt/pb-control/platform-console/server.py`

---

## 4) Что и как деплоить

### Frontend (CRM UI)

1. Коммит + push в `main`.
2. Ждать Vercel deploy.
3. Проверить UI в браузере.

### Backend (platform-console / AI gateway)

Нужно отдельное обновление на сервере:

1. Обновить файл/код в `/opt/pb-control/platform-console/`.
2. Перезапустить сервис:

```bash
systemctl restart platform-console.service
systemctl is-active platform-console.service
journalctl -u platform-console.service -n 50 --no-pager
```

3. Проверить аудит:

```bash
tail -n 50 /opt/pb-control/ai-gateway-audit.jsonl
```

---

## 5) AI-контур: как не ошибиться

- Endpoint для CRM: `POST /owner/api/public/ai/analyze-deal`
- Frontend env: `VITE_AI_GATEWAY_URL` (должен указывать на `control.nwlvl.ru/owner/api/public`)
- Данные пишутся в tenant:
  - `ai_insights`
  - `timeline` (`ai_analysis`)
  - `deals.current_score/current_recommendations`

Частый источник путаницы:

- UI уже новый (из Vercel), а gateway старый (не перезапущен на сервере).

---

## 6) Мини-чеклист новой сессии агента

```powershell
# 1) Проверка primary repo
git -C "C:\Users\Данила\Documents\GitHub\CRM-New-Level-v2" status -sb
git -C "C:\Users\Данила\Documents\GitHub\CRM-New-Level-v2" remote -v

# 2) Проверка SSH до сервера
ssh -o BatchMode=yes -o ConnectTimeout=8 root@2.58.69.58 "echo connected && hostname && whoami"

# 3) Проверка platform-console статуса
ssh root@2.58.69.58 "systemctl is-active platform-console.service"
```

---

## 7) Правила работы для нового агента

1. Прочитать этот файл + `README.md` в PRIMARY repo.
2. Подтвердить путь репозитория и окружение перед правками.
3. Любые изменения по AI/gateway считать двуступенчатыми:
   - git push (frontend/кодовая история),
   - отдельный rollout backend на сервер.
4. После изменений давать короткий отчёт:
   - что изменено,
   - что проверено,
   - что задеплоено,
   - что осталось сделать.

---

## 8) Готовый стартовый промпт для нового агента

```text
Работаем с CRM NewLevel.

Сначала прочитай:
1) AGENT_CONTEXT.md
2) README.md

Рабочий репозиторий (primary):
C:\Users\Данила\Documents\GitHub\CRM-New-Level-v2

Сервер:
ssh root@2.58.69.58 (ключ уже настроен в профиле пользователя).

Важно:
- push в main => автодеплой только frontend (Vercel),
- backend gateway (platform-console) деплоится отдельно на сервере.

Начни с проверки git/remote/ssh и только потом выполняй задачу end-to-end.
```
