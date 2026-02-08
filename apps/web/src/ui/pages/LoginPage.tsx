import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../../app/AuthProvider";

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
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="text-xl font-semibold">CRM «Решение»</div>
          <div className="text-xs text-text2 mt-1">Вход</div>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
