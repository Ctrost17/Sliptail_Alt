"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function SignupPage() {
  const { signup, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await signup(email.trim(), password, username.trim() || undefined);
      setDone(true);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string") {
        setErr((e as { message: string }).message);
      } else {
        setErr("Signup failed");
      }
    }
  };

  if (done) {
    return (
      <main className="p-6 max-w-md mx-auto">
        <h1 className="text-xl font-semibold mb-2">Check your email</h1>
        <p>We sent you a verification link to complete sign up.</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Sign up</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2"
               placeholder="Email"
               type="email"
               value={email}
               onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full border rounded px-3 py-2"
               placeholder="Username (optional)"
               value={username}
               onChange={(e)=>setUsername(e.target.value)} />
        <input className="w-full border rounded px-3 py-2"
               placeholder="Password"
               type="password"
               value={password}
               onChange={(e)=>setPassword(e.target.value)} />
        {err && <p className="text-red-600">{err}</p>}
        <button disabled={loading}
                className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
          {loading ? "…" : "Create account"}
        </button>
      </form>
      <p className="mt-3">
        Already have an account? <a className="underline" href="/auth/login">Log in</a>
      </p>
    </main>
  );
}