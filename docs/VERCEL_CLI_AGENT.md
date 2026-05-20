# Доступ агента к Vercel

CLI установлен глобально: `vercel` (Vercel CLI 54+).

## Способ 1 — токен (удобно для Cursor)

1. Откройте https://vercel.com/account/tokens  
2. **Create** → имя, например `cursor-agent` → скопируйте токен (показывается один раз).  
3. В папке `apps/web` создайте файл **`.env.vercel`** (уже в `.gitignore`):

   ```
   VERCEL_TOKEN=ваш_токен_без_кавычек
   ```

4. Напишите в чат: **«токен vercel готов»** — агент проверит `vercel whoami`, привяжет проект и сможет смотреть деплои / env.

Шаблон: `apps/web/.env.vercel.example`

Команды агента:

```powershell
.\tools\Invoke-Vercel.ps1 whoami
.\tools\Invoke-Vercel.ps1 ls
.\tools\Invoke-Vercel.ps1 env ls
```

## Способ 2 — вход через браузер

В терминале (один раз):

```powershell
cd apps\web
vercel login
vercel link
```

После входа сессия хранится в `%USERPROFILE%\.vercel\auth.json` — агент в этой же машине сможет вызывать `vercel` без токена в файле.

## Корень проекта на Vercel

Для этого репозитория Root Directory в настройках проекта должен быть **`apps/web`** (как при деплое с GitHub).

## Безопасность

- Не коммитьте `.env.vercel` и не вставляйте токен в чат.  
- Токен можно отозвать на странице tokens в любой момент.
