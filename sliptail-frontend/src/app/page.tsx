import Link from "next/link";


function Badge({ children }: { children: React.ReactNode }) {
return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">{children}</span>;
}


function Button(
{ children, href, variant = "primary" }:
{ children: React.ReactNode; href: string; variant?: "primary" | "ghost" }
) {
const base = "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition active:translate-y-px";
const styles = variant === "primary" ? "bg-black text-white hover:bg-black/90 shadow" : "bg-white text-black hover:bg-neutral-100 border";
return (
<Link href={href} className={`${base} ${styles}`}>
{children}
</Link>
);
}


export default function HomePage() {
return (
<main>
{/* Hero */}
<section className="relative overflow-hidden border-b bg-gradient-to-b from-white to-neutral-50">
<div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2">
<div>
<h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
Build your audience. <span className="underline decoration-black/20">Own your income</span>.
</h1>
<p className="mt-4 text-neutral-700 md:text-lg">
Sell memberships, digital downloads, and custom requests—all in one place.
</p>
<div className="mt-6 flex gap-3">
<Button href="/auth/signup">Start for free</Button>
<Button href="/creators" variant="ghost">Explore creators</Button>
</div>
<div className="mt-6 flex items-center gap-3 text-xs text-neutral-600">
<Badge>No monthly fees</Badge>
<Badge>Payouts via Stripe</Badge>
<Badge>Video-ready uploads</Badge>
</div>
</div>
<div className="aspect-video w-full overflow-hidden rounded-2xl border shadow">
<img className="h-full w-full object-cover" alt="Creator montage" src="https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1600&auto=format&fit=crop" />
</div>
</div>
</section>


{/* Quick links row */}
<section className="mx-auto max-w-6xl px-4 py-10">
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
<Link href="/creators" className="rounded-2xl border p-4 hover:bg-neutral-50">
<div className="text-sm font-semibold">Browse creators →</div>
<div className="mt-1 text-sm text-neutral-600">Find someone to support</div>
</Link>
<Link href="/products" className="rounded-2xl border p-4 hover:bg-neutral-50">
<div className="text-sm font-semibold">Explore products →</div>
<div className="mt-1 text-sm text-neutral-600">Downloads, memberships, requests</div>
</Link>
<Link href="/auth/login" className="rounded-2xl border p-4 hover:bg-neutral-50">
<div className="text-sm font-semibold">Sign in →</div>
<div className="mt-1 text-sm text-neutral-600">Access your account</div>
</Link>
<Link href="/dashboard" className="rounded-2xl border p-4 hover:bg-neutral-50">
<div className="text-sm font-semibold">Creator dashboard →</div>
<div className="mt-1 text-sm text-neutral-600">Manage products & sales</div>
</Link>
</div>
</section>


{/* How it works */}
<section id="how" className="mt-4 bg-neutral-50/60 py-16">
<div className="mx-auto max-w-6xl px-4">
<h3 className="text-xl font-bold">How it works</h3>
<ol className="mt-4 grid list-decimal gap-3 pl-5 text-sm text-neutral-700 md:grid-cols-2">
<li>Creators connect Stripe and publish products (downloads, memberships, requests).</li>
<li>Fans browse, purchase, and request via secure checkout.</li>
<li>Deliver digital files instantly; manage memberships & perks.</li>
<li>Creators track sales and payouts in their dashboard.</li>
</ol>
</div>
</section>


{/* Footer */}
<footer className="mt-20 border-t">
<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 md:flex-row">
<div className="flex items-center gap-3">
<span className="inline-block h-7 w-7 rounded-2xl bg-black" />
<span className="text-sm font-semibold">Sliptail</span>
</div>
<p className="text-xs text-neutral-600">© {new Date().getFullYear()} Sliptail. All rights reserved.</p>
</div>
</footer>
</main>
);
}