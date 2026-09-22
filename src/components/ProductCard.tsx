import Link from 'next/link'
import type { Product } from '@/lib/types'
import { ProductImageCarousel } from './ProductImageCarousel'

export function ProductCard({ product }: { product: Product }) {
  const discount = Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)

  return (
    <div className="group block card hover:shadow-lg">
      <div className="relative">
        <ProductImageCarousel images={product.images?.length ? product.images : product.image ? [product.image] : []} alt={product.title} className="product-img-wrap" />
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-gold-500 text-white text-xs font-semibold px-2 py-0.5">
            {discount}% OFF
          </span>
        )}
      </div>

      {/* Info */}
      <Link href={`/products/${product.handle}`} className="block p-4">
        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--gold)' }}>{product.type}</p>
        <h3 className="font-serif text-lg font-medium mb-2 group-hover:text-gold-600 transition-colors" style={{ color: 'var(--text)' }}>
          {product.title}
        </h3>
        {product.aboutItem[0] && (
          <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--text-2)' }}>{product.aboutItem[0]}</p>
        )}
        <div className="flex items-baseline gap-1">
          <span className="font-serif text-lg font-semibold" style={{ color: 'var(--text)' }}>
            ₹{product.price.toLocaleString('en-IN')}
          </span>
          {product.compareAtPrice > product.price && (
            <span className="text-sm line-through" style={{ color: 'var(--text-2)' }}>
              ₹{product.compareAtPrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}
