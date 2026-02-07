import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { pb } from "../../../lib/pb";

export function AdminUsersPage() {
  const [users, setUsers] = React.useState<any[]>([]);
  // MVP: роли храним как enum в auth-коллекции `users.role_name`.
  // settings_roles остаётся для матрицы прав и лейблов.
  const ROLE_FALLBACK = [
    { value: "admin", label: "Админ" },
    { value: "manager", label: "Менеджер" },
    { value: "viewer", label: "Вьюер" },
  ];
  const [roles, setRoles] = React.useState<Array<{ value: string; label: string }>>(ROLE_FALLBACK);
  const [open, setOpen] = React.useState(false);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("");

  async function load() {
    const u = await pb.collection("users").getList(1, 200, { sort: "email" });
    const r = await pb.collection("settings_roles").getFullList({ sort: "role_name" }).catch(() => []);
    setUsers(u.items);
    // If settings_roles exists and filled - use it; else fallback.
    const mapped = (r as any[])
      .map((x) => ({ value: x.role_name, label: x.label ?? x.role_name }))
      .filter((x) => !!x.value);
    setRoles(mapped.length ? mapped : ROLE_FALLBACK);
  }

  React.useEffect(() => { load(); }, []);

  async function createUser() {
    if (!email || !password) return;
    if (!role) { alert("Выберите роль"); return; }
    const data: any = { email, password, passwordConfirm: password };
    if (name.trim()) data.name = name.trim();
    if (role) data.role_name = role;
    await pb.collection("users").create(data);
    setOpen(false);
    setName(""); setEmail(""); setPassword(""); setRole("");
    load();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Пользователи</div>
            <div className="text-xs text-text2 mt-1">Список + добавление + назначение ролей (матрица доступов хранится в `settings_roles`)</div>
          </div>
          <Button onClick={() => setOpen(true)}>Добавить пользователя</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                <th className="text-left px-3">Имя</th>
                <th className="text-left px-3">Email</th>
                <th className="text-left px-3">Роль</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="h-11 border-b border-border">
                  <td className="px-3">{u.name ?? "—"}</td>
                  <td className="px-3 text-text2">{u.email}</td>
                  <td className="px-3">
                    <select
                      className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm"
                      value={u.role_name ?? ""}
                      onChange={async (e) => {
                        await pb.collection("users").update(u.id, { role_name: e.target.value || null });
                        load();
                      }}
                    >
                      <option value="">—</option>
                      {roles.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length ? <div className="text-sm text-text2 py-6">Пользователей пока нет.</div> : null}
        </div>
      </CardContent>

      <Modal open={open} title="Добавить пользователя" onClose={() => setOpen(false)} widthClass="max-w-lg">
        <div className="grid gap-3">
          <div>
            <div className="text-xs text-text2 mb-1">Имя</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван" />
          </div>
          <div>
            <div className="text-xs text-text2 mb-1">Email *</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@company.ru" />
          </div>
          <div>
            <div className="text-xs text-text2 mb-1">Пароль *</div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" />
          </div>
          <div>
            <div className="text-xs text-text2 mb-1">Роль</div>
            <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">— выбери роль —</option>
              <option value="">—</option>
              {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={createUser} disabled={!email || !password}>Создать</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
