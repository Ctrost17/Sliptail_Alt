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
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-12">
        <h1 className="mb-4 text-3xl font-bold">Featured Sellers</h1>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {featured.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Explore by category</h2>
        <div className="flex flex-wrap gap-3">
          {categories.map((cat) => (
            <a
              key={cat}
              href={`/creators?category=${cat}`}
              className="rounded bg-neutral-200 px-4 py-2 hover:bg-neutral-300"
            >
              {cat}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
