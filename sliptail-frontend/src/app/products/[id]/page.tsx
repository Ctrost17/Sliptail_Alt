import { fetchApi } from "@/lib/api";
import type { Product } from "@/types/products";
import ProductDetail from "./ProductDetail";
import { CartProvider } from "@/components/cart/CartProvider";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { id: string } }) {
  let product: Product | null = null;

  try {
    // Cast since we're not using raw:true
    product = (await fetchApi<Product>(`/api/products/${params.id}`)) as Product;
  } catch (e) {
    // If backend returns 404/500, route to Next.js 404 page
    notFound();
  }

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <CartProvider>
        <ProductDetail product={product} />
      </CartProvider>
    </main>
  );
}