import React from "react";
import { pb, getAuthUser, AuthUser } from "../lib/pb";

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = React.createContext<AuthCtx | null>(null);

export function useAuth() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(getAuthUser());
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(false);
    return pb.authStore.onChange(() => setUser(getAuthUser()), true);
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    await pb.collection("users").authWithPassword(email, password);
  }, []);

  const logout = React.useCallback(() => {
    pb.authStore.clear();
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
