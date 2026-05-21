import DOMPurify from "dompurify";

/** Безопасный HTML для листа КП/ТКП (редактор TipTap + импорт Word). */
export function sanitizeKpHtml(html: string): string {
  if (!html?.trim()) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "mark",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "style", "class", "colspan", "rowspan"],
    ALLOW_DATA_ATTR: false,
  });
}

/** Плоский текст из HTML (для полей без разметки). */
export function htmlToPlainText(html: string): string {
  const clean = sanitizeKpHtml(html);
  if (typeof document === "undefined") return clean.replace(/<[^>]+>/g, " ").trim();
  const div = document.createElement("div");
  div.innerHTML = clean;
  return (div.textContent || "").trim();
}

/** HTML или plain — для технического блока в PDF. */
export function renderRichOrPlain(value: string): { html: string; isHtml: boolean } {
  const v = String(value || "").trim();
  if (!v) return { html: "", isHtml: false };
  if (/<[a-z][\s\S]*>/i.test(v)) {
    return { html: sanitizeKpHtml(v), isHtml: true };
  }
  return { html: "", isHtml: false };
}
