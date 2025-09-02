"use client";

import Protected from "@/components/auth/Protected";
import { useAuth } from "@/components/auth/AuthProvider";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <Protected>
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-neutral-700 mb-4">
          Welcome, {user?.username || user?.email}!
        </p>
        <button onClick={logout} className="px-4 py-2 rounded bg-neutral-900 text-white">
          Log out
        </button>
      </main>
    </Protected>
  );
}