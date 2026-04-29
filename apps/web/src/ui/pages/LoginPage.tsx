import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../../app/AuthProvider";
import logo from "../../assets/newlevel-logo.png";

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (user) nav("/", { replace: true });
  }, [user, nav]);

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 theme-cockpit">
      <div className="w-full max-w-lg rounded-[22px] border border-[rgba(51,215,255,0.35)] bg-[rgba(15,23,42,0.55)] p-2 shadow-[0_0_38px_rgba(51,215,255,0.22)]">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src={logo} alt="NewLevel CRM" className="w-14 h-14 rounded-2xl border border-[rgba(255,255,255,0.12)]" />
            <div>
              <div className="text-xl font-extrabold">NewLevel CRM</div>
              <div className="text-xs text-text2 mt-1">Вход в рабочий кабинет</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div>
              <div className="text-xs text-text2 mb-1">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.ru" />
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Пароль</div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {err ? <div className="text-sm text-danger">{err}</div> : null}
            <Button onClick={submit} disabled={loading || !email || !password}>{loading ? "Входим..." : "Войти"}</Button>
            <div className="text-sm text-text2 text-center">
              Еще нет кабинета? <Link to="/register" className="text-primary underline">Зарегистрироваться</Link>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
