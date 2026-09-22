import { getProducts } from '@/lib/products'
import { ProductCatalog } from '@/components/ProductCatalog'

export default async function ProductsPage() {
  const products = (await getProducts()).filter(p => p.status === 'active')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--gold)' }}>Our Collection</p>
        <h1 className="section-title">All Products</h1>
        <div className="divider mx-auto" />
        <p className="section-subtitle mx-auto text-center">
          Handcrafted pieces shaped by skilled artisans and chosen for thoughtful, lasting spaces.
        </p>
      </div>

      <ProductCatalog products={products} />
    </div>
  )
}
