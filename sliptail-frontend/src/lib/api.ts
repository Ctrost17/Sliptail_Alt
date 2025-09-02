import axios, { type AxiosError } from "axios";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

// ------------------------------------------------------------------
// Lightweight fetch() helper (works in SSR/Server Components too)
// ------------------------------------------------------------------
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function fetchApi<T>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    token?: string | null;
    headers?: Record<string, string>;
    raw?: boolean; // if true, returns the Response (useful for file downloads)
  } = {}
): Promise<T> {
  const { method = "GET", body, token, headers = {}, raw = false } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // harmless now, future-proof if you move to cookies
    cache: "no-store",
  });

  if (raw) return res as unknown as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON responses: keep data = null
  }

  if (!res.ok) {
    const { error, message } = (data ?? {}) as { error?: string; message?: string };
    const errorMessage = error || message || `Request failed (${res.status})`;
    throw new Error(errorMessage);
  }

  return data as T;
}

// ------------------------------------------------------------------
// Axios instance (Axios v1+ compatible typings)
// ------------------------------------------------------------------
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false, // set true if you later use httpOnly cookies/sessions
});

// Attach Authorization header from localStorage token (client only)
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      // headers can be a plain object or AxiosHeaders — normalize safely
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return config;
});

// Normalize API errors → always throw Error(message)
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: string; message?: string }>) => {
    const msg =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      "Request failed";
    return Promise.reject(new Error(msg));
  }
);

// ------------------------------------------------------------------
// Small typed helpers that return response.data directly
// ------------------------------------------------------------------
export async function apiGet<T>(url: string, config?: Parameters<typeof api.get>[1]) {
  const res = await api.get<T>(url, config);
  return res.data;
}

export async function apiPost<T>(
  url: string,
  data?: unknown,
  config?: Parameters<typeof api.post>[2]
) {
  const res = await api.post<T>(url, data, config);
  return res.data;
}

export async function apiPut<T>(
  url: string,
  data?: unknown,
  config?: Parameters<typeof api.put>[2]
) {
  const res = await api.put<T>(url, data, config);
  return res.data;
}

export async function apiPatch<T>(
  url: string,
  data?: unknown,
  config?: Parameters<typeof api.patch>[2]
) {
  const res = await api.patch<T>(url, data, config);
  return res.data;
}

export async function apiDelete<T>(
  url: string,
  config?: Parameters<typeof api.delete>[1]
) {
  const res = await api.delete<T>(url, config);
  return res.data;
}
