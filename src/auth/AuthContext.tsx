import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export type Branch = { id: number; name: string; address?: string; status: string };

export type User = {
  id: number;
  email: string;
  role: "admin" | "staff";
  status?: string;
  first_name?: string;
  last_name?: string;
};

export type Me = { user: User; branches: Branch[] };

type AuthCtx = {
  token: string;
  me: Me | null;
  user: User | null;
  branches: Branch[];
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;

  activeBranchId: string;
  setActiveBranchId: (id: string) => void;

  isAdmin: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string>(localStorage.getItem("token") || "");
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeBranchId, setActiveBranchIdState] = useState<string>(
    localStorage.getItem("activeBranchId") || ""
  );

  const setActiveBranchId = (id: string) => {
    localStorage.setItem("activeBranchId", id);
    setActiveBranchIdState(id);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("activeBranchId");
    setToken("");
    setMe(null);
  };

  const login = async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password });
    const t = (r.data?.token || "") as string;
    if (!t) throw new Error("Missing token");
    localStorage.setItem("token", t);
    setToken(t);
    // load user immediately after login
    await refreshMe(t);
  };

  // If token changes (refresh/restore), fetch /auth/me
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (!token) {
          setMe(null);
          return;
        }
        await refreshMe(token);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * Refresh /auth/me and keep branch selection valid
   */
  const refreshMe = async (tkn?: string) => {
    // optionally accept token (useful right after login)
    if (tkn) {
      localStorage.setItem("token", tkn);
      setToken(tkn);
    }

    const r = await api.get("/auth/me");
    const data = r.data as any;

    const branches: Branch[] = data.branches || [];
    const user: User = data.user;

    setMe({ user, branches });

    // Ensure active branch is set and still exists
    const stored = localStorage.getItem("activeBranchId") || "";
    const storedValid = stored && branches.some((b) => String(b.id) === String(stored));

    if (!storedValid) {
      if (branches.length > 0) {
        setActiveBranchId(String(branches[0].id));
      } else {
        setActiveBranchId("");
      }
    }
  };

  const user = me?.user ?? null;
  const branches = me?.branches ?? [];
  const isAdmin = user?.role === "admin";

  const value = useMemo<AuthCtx>(
    () => ({
      token,
      me,
      user,
      branches,
      loading,
      login,
      logout,
      refreshMe,
      activeBranchId,
      setActiveBranchId,
      isAdmin,
    }),
    [token, me, loading, activeBranchId]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}