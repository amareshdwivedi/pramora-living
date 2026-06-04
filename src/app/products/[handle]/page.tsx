import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProduct, getProducts } from '@/lib/products'

export async function generateStaticParams() {
  return getProducts().map(p => ({ handle: p.handle }))
}

export default function ProductPage({ params }: { params: { handle: string } }) {
  const product = getProduct(params.handle)
  if (!product) notFound()

  const discount = product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0

  const shopLinks = [
    { label: 'Buy on Amazon',    href: product.amazonUrl  || 'https://amazon.in',    dot: '#FF9900' },
    { label: 'Buy on Flipkart',  href: product.flipkartUrl|| 'https://flipkart.com', dot: '#2874F0' },
    { label: 'Buy on Meesho',    href: product.meeshoUrl  || 'https://meesho.com',   dot: '#9B2D8E' },
    {
      label: 'Order on WhatsApp',
      href: `https://wa.me/919880009575?text=Hi%2C%20I%20want%20to%20order%20${encodeURIComponent(product.title)}%20(₹${product.price})`,
      dot: '#25D366',
    },
  ]

  return (
    <div className="container-craft py-12 md:py-16">
      {/* Back */}
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-2xs uppercase tracking-widest mb-12 transition-opacity hover:opacity-50"
        style={{ color: 'var(--text-2)' }}
      >
        <ArrowLeft size={13} /> All Products
      </Link>

      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
        {/* Image */}
        <div className="img-hover relative aspect-[3/4]" style={{ backgroundColor: 'var(--bg-2)' }}>
          <Image
            src={product.image || '/images/placeholder.jpg'}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
          {discount > 0 && (
            <span
              className="absolute top-4 left-4 text-2xs uppercase tracking-widest font-medium px-2 py-1"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
            >
              −{discount}%
            </span>
          )}
        </div>

        {/* Details */}
        <div className="lg:pt-4">
          <p className="overline mb-3">{product.type}</p>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl leading-tight mb-6" style={{ color: 'var(--text)' }}>
            {product.title}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-8">
            <span className="font-sans text-2xl font-medium" style={{ color: 'var(--text)' }}>
              ₹{product.price.toLocaleString('en-IN')}
            </span>
            {product.compareAtPrice > product.price && (
              <span className="font-sans text-base font-light line-through" style={{ color: 'var(--text-3)' }}>
                ₹{product.compareAtPrice.toLocaleString('en-IN')}
              </span>
            )}
            {discount > 0 && (
              <span className="text-2xs uppercase tracking-widest font-medium text-green-600 dark:text-green-400">
                Save {discount}%
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px mb-8" style={{ backgroundColor: 'var(--border)' }} />

          {/* Description */}
          <div
            className="craft-prose text-sm font-light leading-relaxed mb-8"
            style={{ color: 'var(--text-2)' }}
            dangerouslySetInnerHTML={{ __html: product.description }}
          />

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-10">
            {product.tags.map(tag => (
              <span key={tag} className="craft-tag">{tag}</span>
            ))}
          </div>

          <div className="h-px mb-8" style={{ backgroundColor: 'var(--border)' }} />

          {/* Purchase options */}
          <p className="overline mb-5">Purchase From</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shopLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary gap-3 text-left"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.dot }} />
                {l.label}
              </a>
            ))}
          </div>

          {/* SKU */}
          <p className="text-2xs uppercase tracking-widest mt-8" style={{ color: 'var(--text-3)' }}>
            SKU: {product.sku}
          </p>
        </div>
      </div>
    </div>
  )
}
