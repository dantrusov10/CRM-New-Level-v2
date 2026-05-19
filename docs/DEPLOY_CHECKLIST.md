# Чеклист деплоя NewLevel CRM

## Frontend (автоматически)

1. `git push origin main`
2. Дождаться успешного Vercel Production deploy
3. Проверить https://app.nwlvl.ru (жёсткое обновление Ctrl+Shift+R)

## Backend / AI gateway (вручную на сервере)

Только если менялись файлы в `backend/platform-console/`:

```bash
ssh root@2.58.69.58

# обновить код (git pull в /opt/pb-control или scp server.py)
systemctl restart platform-console.service
systemctl is-active platform-console.service
journalctl -u platform-console.service -n 50 --no-pager

# smoke AI
curl -sS -o /dev/null -w "%{http_code}\n" https://control.nwlvl.ru/owner/api/public/health || true
```

## После каждого релиза UI

- [ ] Логин
- [ ] Дашборд открывается
- [ ] Таблица сделок: фильтры, колонки, виды
- [ ] Карточка сделки + AI анализ
- [ ] Админ-раздел (если менялся)
