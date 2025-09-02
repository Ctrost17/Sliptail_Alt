"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";


const links = [
{ href: "/creators", label: "Creators" },
{ href: "/dashboard", label: "Dashboard" },
];


export default function Navbar() {
const pathname = usePathname();
const isActive = (href: string) => (pathname === href ? "text-black" : "text-neutral-700");


return (
<header className="sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur">
<div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
<div className="flex items-center gap-3">
<Link href="/" className="flex items-center gap-3">
<span className="inline-block h-8 w-8 rounded-2xl bg-black" />
<span className="text-lg font-bold tracking-tight">Sliptail</span>
</Link>
</div>
<nav className="hidden gap-6 md:flex">
{links.map((l) => (
<Link key={l.href} href={l.href} className={`text-sm hover:text-black ${isActive(l.href)}`}>
{l.label}
</Link>
))}
</nav>
<div className="flex items-center gap-2">
<Link href="/auth/login" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-neutral-100">Sign in</Link>
<Link href="/auth/signup" className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90">Become a creator</Link>
</div>
</div>
</header>
);
}