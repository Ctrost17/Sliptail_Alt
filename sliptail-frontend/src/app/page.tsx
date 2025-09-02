"use client";

import { Button, Card, Input } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card title="Welcome to Sliptail">
        <p className="text-neutral-600">
          This is your Next.js frontend. Use the nav to log in and view the dashboard.
        </p>
        <div className="mt-6 space-y-4">
          <Input placeholder="Try the input" />
          <div className="space-x-3">
            <Button onClick={() => (window.location.href = "/auth/login")}>Login</Button>
            <Button
              variant="secondary"
              onClick={() => (window.location.href = "/auth/signup")}
            >
              Sign up
            </Button>
            <Button
              variant="secondary"
              onClick={() => (window.location.href = "/dashboard")}
            >
              Dashboard
            </Button>
          </div>
        </div>
      </Card>
    </main>
  );
}