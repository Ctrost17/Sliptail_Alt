import Image from "next/image";
import Link from "next/link";
import CreatorCard from "@/components/CreatorCard";

const featured = [
  {
    id: "1",
    displayName: "Alice",
    avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=100&h=100&fit=crop",
    bio: "Photographer & traveler",
    rating: 4.8,
    photos: [
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1503264116251-35a269479413?w=200&h=200&fit=crop",
    ],
  },
];

const categories = ["art", "photography", "music", "fashion"];

export default function Home() {
  return (
    <div className="font-sans">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-green-400 to-green-600 text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="mx-auto mb-6 w-40 animate-fade-in-up">
            <Image src="/sliptail-logo.png" alt="Sliptail" width={160} height={50} />
          </div>
          <h1 className="mb-4 text-5xl font-bold animate-fade-in-up [animation-delay:200ms]">Support and Create</h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg animate-fade-in-up [animation-delay:400ms]">
            Sliptail helps creators provide memberships, digital downloads, and custom requests — all in one place.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/signup"
              className="rounded-md bg-white px-8 py-3 font-semibold text-green-700 shadow transition hover:scale-105"
            >
              For Creators: Start Selling
            </Link>
            <Link
              href="/creators"
              className="rounded-md border border-white px-8 py-3 font-semibold text-white transition hover:scale-105 hover:bg-white/20"
            >
              For Fans: Explore Creators
            </Link>
          </div>
        </div>
      </section>

      {/* For Creators & Fans Blocks */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-8 shadow transition hover:shadow-lg">
            <h2 className="mb-4 text-3xl font-bold text-green-600">Built for creators like you</h2>
            <p className="text-gray-700">
              Upload videos, e-books, or any digital content. Offer memberships with exclusive perks. Accept custom requests.
              Connect Stripe and start earning in minutes.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-8 shadow transition hover:shadow-lg">
            <h2 className="mb-4 text-3xl font-bold text-green-600">Support your favorites</h2>
            <p className="text-gray-700">
              Subscribe to your favorite creators, download their work, or request something personal. It’s never been easier to support
              creativity.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Creators */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-8 text-center text-3xl font-bold">Featured Creators</h2>
          <div className="grid justify-items-center gap-6 sm:grid-cols-2 md:grid-cols-3">
            {featured.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Explore Categories */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-4 text-2xl font-bold">Explore by category</h2>
        <div className="flex flex-wrap gap-3">
          {categories.map((cat) => (
            <a
              key={cat}
              href={`/creators?category=${cat}`}
              className="rounded-full border border-green-500 px-5 py-2 capitalize text-green-700 transition hover:bg-green-50"
            >
              {cat}
            </a>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-green-500 to-green-700 py-20 text-center text-white">
        <h2 className="mb-4 text-4xl font-bold">Join Sliptail today</h2>
        <p className="mx-auto mb-8 max-w-xl text-lg">
          Whether you’re a creator or a fan, Sliptail makes connecting simple, safe, and fun.
        </p>
        <Link
          href="/auth/signup"
          className="rounded-md bg-white px-8 py-3 font-semibold text-green-700 shadow transition hover:scale-105"
        >
          Get Started
        </Link>
      </section>
    </div>
  );
}

