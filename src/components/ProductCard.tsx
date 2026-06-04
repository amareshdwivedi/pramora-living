import Link from 'next/link'
import Image from 'next/image'
import type { Product } from '@/lib/types'

export function ProductCard({ product }: { product: Product }) {
  const discount = Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)

  return (
    <Link href={`/products/${product.handle}`} className="group block card hover:shadow-lg">
      {/* Image */}
      <div className="product-img-wrap relative aspect-square overflow-hidden" style={{ backgroundColor: 'var(--bg-2)' }}>
        <Image
          src={product.image || '/images/placeholder.jpg'}
          alt={product.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-gold-500 text-white text-xs font-semibold px-2 py-0.5">
            {discount}% OFF
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--gold)' }}>{product.type}</p>
        <h3 className="font-serif text-lg font-medium mb-2 group-hover:text-gold-600 transition-colors" style={{ color: 'var(--text)' }}>
          {product.title}
        </h3>
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
      </div>
    </Link>
  )
}
