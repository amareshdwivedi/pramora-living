import { getProducts } from '@/lib/products'
import { ProductCard } from '@/components/ProductCard'

export default function ProductsPage() {
  const products = getProducts().filter(p => p.status === 'active')

  return (
    <div className="container-craft py-16 md:py-24">
      {/* Header */}
      <div className="text-center mb-16">
        <p className="overline mb-4">Pramora Living</p>
        <h1 className="font-serif text-4xl md:text-5xl mb-4" style={{ color: 'var(--text)' }}>
          The Collection
        </h1>
        <div className="rule mx-auto" />
        <p className="body-text max-w-md mx-auto">
          Handcrafted sculptures and home décor, made with care and chosen for beauty.
        </p>
        <p className="overline mt-6" style={{ color: 'var(--text-3)' }}>
          {products.length} pieces
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-14">
        {products.map(p => <ProductCard key={p.handle} product={p} />)}
      </div>

      {products.length === 0 && (
        <div className="text-center py-24">
          <p className="font-serif text-2xl" style={{ color: 'var(--text-2)' }}>
            No products available yet.
          </p>
        </div>
      )}
    </div>
  )
}
