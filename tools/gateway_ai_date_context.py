"""
Референс для AI gateway (platform-console): единый блок дат для любого LLM-вызова.

Скопируйте функции в серверный код и вызывайте перед каждым chat/completions.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, List, Optional, Tuple


def now_request_instant_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_instant(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if len(s) >= 19 and s[4] == "-" and s[10] == " " and "T" not in s[:19]:
        s = s[:10] + "T" + s[11:]
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _day_utc(dt: datetime) -> str:
    u = dt.astimezone(timezone.utc)
    return u.strftime("%Y-%m-%d")


def format_timeline_digest_for_ai(rows: Iterable[dict[str, Any]], *, max_lines: int = 80) -> str:
    parsed: List[Tuple[float, str]] = []
    for r in rows:
        ts = _parse_instant(r.get("timestamp")) or _parse_instant(r.get("created"))
        if not ts:
            continue
        action = str(r.get("action") or "event").strip()
        comment = str(r.get("comment") or "").replace("\n", " ").strip()
        if len(comment) > 400:
            comment = comment[:397] + "…"
        line = f"- [{_day_utc(ts)} UTC] {action}: {comment}"
        parsed.append((ts.timestamp(), line))
    parsed.sort(key=lambda x: x[0], reverse=True)
    return "\n".join(line for _, line in parsed[:max_lines])


def format_deal_dates_for_ai(deal: Optional[dict[str, Any]]) -> str:
    if not deal:
        return ""
    parts: List[str] = []
    c = _parse_instant(deal.get("created"))
    u = _parse_instant(deal.get("updated"))
    if c:
        parts.append(f"Сделка создана (UTC дата): {_day_utc(c)}")
    if u:
        parts.append(f"Сделка обновлена (UTC дата): {_day_utc(u)}")
    return "\n".join(parts)


def build_ai_date_discipline_instructions() -> str:
    return "\n".join(
        [
            "Контекст времени:",
            "- Поле request_instant_utc — это текущий момент запроса к ИИ (опорная точка «сейчас»).",
            "- В блоке «Хронология CRM» у каждой строки указана дата СОБЫТИЯ (не «сегодня»).",
            "- Сравнивай утверждения в старых комментариях с request_instant_utc и с более новыми событиями сверху списка.",
            "- Не предлагай «ждать» событие, если по датам и более свежим записям оно уже должно было произойти, "
            "пока нет явного свежего подтверждения обратного.",
        ]
    )


def build_ai_date_context_envelope(
    *,
    timeline_rows: Optional[Iterable[dict[str, Any]]] = None,
    deal: Optional[dict[str, Any]] = None,
    request_instant_utc_iso: Optional[str] = None,
    max_timeline_lines: int = 80,
) -> str:
    req = request_instant_utc_iso or now_request_instant_utc_iso()
    deal_dates = format_deal_dates_for_ai(deal) or "(нет полей created/updated)"
    digest = format_timeline_digest_for_ai(timeline_rows or [], max_lines=max_timeline_lines) or "(нет событий timeline)"
    return "\n".join(
        [
            "### Метаданные запроса к ИИ",
            f"request_instant_utc: {req}",
            "",
            "### Ключевые даты сущности",
            deal_dates,
            "",
            "### Хронология CRM (сначала новые; дата = дата события)",
            digest,
            "",
            "### Инструкция по датам",
            build_ai_date_discipline_instructions(),
        ]
    )
