"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "@/lib/api";
import { loadAuth, saveAuth, clearAuth, AuthState, SafeUser } from "@/lib/auth";

type AuthContextType = {
  user: SafeUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username?: string) => Promise<"verify-sent">;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [{ user, token }, setAuth] = useState<AuthState>({ user: null, token: null });
  const [loading, setLoading] = useState(true);

  // hydrate from localStorage on mount
  useEffect(() => {
    const initial = loadAuth();
    setAuth(initial);
    setAuthToken(initial.token);
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: SafeUser }>("/auth/login", { email, password });
      const next: AuthState = { token: data.token, user: data.user };
      setAuth(next);
      saveAuth(next);
      setAuthToken(next.token);
    } catch (e: unknown) {
      const msg = e?.response?.data?.error || "Login failed";
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function signup(email: string, password: string, username?: string): Promise<"verify-sent"> {
    setLoading(true);
    try {
      const { data } = await api.post<{ checkEmail: boolean }>("/auth/signup", { email, password, username });
      if (data?.checkEmail) {
        return "verify-sent";
      }
      throw new Error("Signup failed");
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Signup failed";
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearAuth();
    setAuth({ user: null, token: null });
    setAuthToken(null);
  }

  const value = useMemo(() => ({ user, token, loading, login, signup, logout }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}