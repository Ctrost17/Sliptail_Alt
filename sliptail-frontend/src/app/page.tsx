export default function Home() {
  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Welcome to Sliptail</h1>
      <p className="text-neutral-600">
        This is your Next.js frontend. Use the nav to log in and view the dashboard.
      </p>
      <div className="mt-6 space-x-3">
        <a className="underline" href="/auth/login">Login</a>
        <a className="underline" href="/auth/signup">Sign up</a>
        <a className="underline" href="/dashboard">Dashboard</a>
      </div>
    </main>
  );
}