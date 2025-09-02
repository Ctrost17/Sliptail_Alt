export type AuthState = {
  token: string | null;
  user: SafeUser | null;
};

const STORAGE_KEY = "sliptail.auth";

export function loadAuth(): AuthState {
  if (typeof window === "undefined") return { token: null, user: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    return JSON.parse(raw);
  } catch {
    return { token: null, user: null };
  }
}

export function saveAuth(state: AuthState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export type SafeUser = {
  id: number;
  email: string;
  username: string | null;
  role: "user" | "creator" | "admin";
  email_verified_at: string | null;
  created_at: string;
};

export type LoginResponse = { token: string; user: SafeUser };