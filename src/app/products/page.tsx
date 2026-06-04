import { getProducts } from '@/lib/products'
import { ProductCard } from '@/components/ProductCard'

export default function ProductsPage() {
  const products = getProducts().filter(p => p.status === 'active')
  const types = [...new Set(products.map(p => p.type))]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--gold)' }}>Our Collection</p>
        <h1 className="section-title">All Products</h1>
        <div className="divider mx-auto" />
        <p className="section-subtitle mx-auto text-center">
          Handcrafted sculptures and home décor pieces for every taste and space.
        </p>
        {/* Category filters */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {types.map(t => (
            <span key={t} className="tag py-1 px-3 text-xs">{t}</span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(p => <ProductCard key={p.handle} product={p} />)}
      </div>

      {products.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--text-2)' }}>
          <p className="text-lg font-serif">No products available yet.</p>
        </div>
      )}
    </div>
  )
}
