"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { SafeUser } from "@/lib/types";
import { clearAuth, loadAuth, saveAuth } from "@/lib/auth";

type AuthContextType = {
  user: SafeUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username?: string) => Promise<"verify-sent">;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [{ token, user }, setAuth] = useState(loadAuth());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    saveAuth({ token, user });
  }, [token, user]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api<{ token: string; user: SafeUser }>(
        "/api/auth/login",
        { method: "POST", body: { email, password } }
      );
      setAuth({ token: data.token, user: data.user });
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, username?: string): Promise<"verify-sent"> => {
    setLoading(true);
    try {
      await api<{ checkEmail: boolean }>("/api/auth/signup", {
        method: "POST",
        body: { email, password, username },
      });
      return "verify-sent";
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuth({ token: null, user: null });
    clearAuth();
  };

  const value = useMemo(
    () => ({ user, token, loading, login, signup, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
