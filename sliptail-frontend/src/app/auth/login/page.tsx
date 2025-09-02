"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (e: unknown) {
      setErr(
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : "Login failed"
      );
    }
  };

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Log in</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2"
               placeholder="Email"
               type="email"
               value={email}
               onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full border rounded px-3 py-2"
               placeholder="Password"
               type="password"
               value={password}
               onChange={(e)=>setPassword(e.target.value)} />
        {err && <p className="text-red-600">{err}</p>}
        <button disabled={loading}
                className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
          {loading ? "…" : "Login"}
        </button>
      </form>
      <p className="mt-3">
        No account? <a className="underline" href="/auth/signup">Sign up</a>
      </p>
    </main>
  );
}