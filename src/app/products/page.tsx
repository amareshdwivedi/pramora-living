import { getProducts } from '@/lib/products'
import { ProductCatalog } from '@/components/ProductCatalog'
import { getSiteLayout } from '@/lib/db/site-layout.repo'
import { orderProducts } from '@/lib/site-layout'

export default async function ProductsPage() {
  const [allProducts, layout] = await Promise.all([getProducts(), getSiteLayout()])
  const products = orderProducts(allProducts.filter(p => p.status === 'active'), layout.catalogOrder)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-[0.3em] mb-2" style={{ color: 'var(--gold)' }}>Our Collection</p>
        <h1 className="section-title">All Products</h1>
        <div className="divider mx-auto mb-4" />
        <p className="section-subtitle mx-auto max-w-none text-center text-sm sm:text-base mb-0 lg:whitespace-nowrap">
          Handcrafted pieces shaped by skilled artisans and chosen for thoughtful, lasting spaces.
        </p>
      </div>

      <ProductCatalog products={products} />
    </div>
  )
}
