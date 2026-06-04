import Link from 'next/link'
import Image from 'next/image'
import type { Product } from '@/lib/types'

export function ProductCard({ product }: { product: Product }) {
  const discount = product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0

  return (
    <Link href={`/products/${product.handle}`} className="group block">
      {/* Image — no card border, full bleed */}
      <div className="img-hover relative aspect-[3/4] w-full" style={{ backgroundColor: 'var(--bg-2)' }}>
        <Image
          src={product.image || '/images/placeholder.jpg'}
          alt={product.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {discount > 0 && (
          <span
            className="absolute top-3 left-3 text-2xs uppercase tracking-widest font-medium px-2 py-1"
            style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
          >
            −{discount}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="pt-4">
        <p className="overline mb-1.5">{product.type}</p>
        <h3
          className="font-serif text-lg leading-snug mb-2 transition-opacity group-hover:opacity-60"
          style={{ color: 'var(--text)' }}
        >
          {product.title}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-sm font-medium" style={{ color: 'var(--text)' }}>
            ₹{product.price.toLocaleString('en-IN')}
          </span>
          {product.compareAtPrice > product.price && (
            <span className="font-sans text-xs font-light line-through" style={{ color: 'var(--text-3)' }}>
              ₹{product.compareAtPrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
