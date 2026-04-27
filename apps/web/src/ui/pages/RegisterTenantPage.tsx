import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import logo from "../../assets/newlevel-logo.png";

const CONTROL_API_URL = "https://control.nwlvl.ru";

function normalizeSubdomain(raw: string) {
  return (raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

export function RegisterTenantPage() {
  const [companyName, setCompanyName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [subdomain, setSubdomain] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const slug = normalizeSubdomain(subdomain);
  const fullDomain = slug ? `${slug}.nwlvl.ru` : "";

  async function submit() {
    setError(null);
    setOk(null);

    if (!companyName.trim()) return setError("Введите название компании.");
    if (!contactName.trim()) return setError("Введите имя контактного лица.");
    if (!email.trim()) return setError("Введите email.");
    if (!slug || slug.length < 3) return setError("Поддомен должен быть минимум 3 символа (a-z, 0-9, -).");

    setLoading(true);
    try {
      const response = await fetch(`${CONTROL_API_URL}/api/collections/tenant_registrations/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          requested_subdomain: slug,
          company_size: "unknown",
          source: "site_form",
          comment: comment.trim(),
          status: "new",
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || "Не удалось отправить заявку.");
      }

      setOk(`Заявка отправлена. После подтверждения будет создан кабинет: ${fullDomain}`);
      setCompanyName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setSubdomain("");
      setComment("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка отправки.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 theme-cockpit">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src={logo} alt="NewLevel CRM" className="w-14 h-14 rounded-2xl border border-[rgba(255,255,255,0.12)]" />
            <div>
              <div className="text-xl font-extrabold">NewLevel CRM</div>
              <div className="text-xs text-text2 mt-1">Регистрация кабинета</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div>
              <div className="text-xs text-text2 mb-1">Компания *</div>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ООО Ромашка" />
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Контактное лицо *</div>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Иван Петров" />
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Email *</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.ru" />
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Телефон</div>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." />
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Желаемый поддомен *</div>
              <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="acme" />
              <div className="text-xs text-text2 mt-1">Будет создано: {fullDomain || "your-slug.nwlvl.ru"}</div>
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Комментарий</div>
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Что важно настроить в первую очередь?" />
            </div>

            {error ? <div className="text-sm text-danger whitespace-pre-wrap">{error}</div> : null}
            {ok ? <div className="text-sm text-success whitespace-pre-wrap">{ok}</div> : null}

            <Button onClick={submit} disabled={loading}>
              {loading ? "Отправляем..." : "Создать кабинет"}
            </Button>

            <div className="text-sm text-text2 text-center">
              Уже есть кабинет? <Link to="/login" className="text-primary underline">Войти</Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

