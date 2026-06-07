import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProduct, getProducts } from '@/lib/products'
import { FaAmazon, FaWhatsapp, SiFlipkart, MeeshoIcon } from '@/components/BrandIcons'

// Render product pages on demand and keep them fresh; new items created by an
// Amazon sync are served without a rebuild.
export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams() {
  return (await getProducts()).map(p => ({ handle: p.handle }))
}

export default async function ProductPage({ params }: { params: { handle: string } }) {
  const product = await getProduct(params.handle)
  if (!product) notFound()

  const discount = Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)

  const shopLinks = [
    { label: 'Buy on Amazon',    href: product.amazonUrl   || 'https://amazon.in',    color: '#FF9900', Icon: FaAmazon },
    { label: 'Buy on Flipkart',  href: product.flipkartUrl || 'https://flipkart.com', color: '#2874F0', Icon: SiFlipkart },
    { label: 'Buy on Meesho',    href: product.meeshoUrl   || 'https://meesho.com',   color: '#9B2D8E', Icon: MeeshoIcon },
    {
      label: 'Order on WhatsApp',
      href: `https://wa.me/919880009575?text=Hi%2C%20I%20want%20to%20order%20${encodeURIComponent(product.title)}%20(₹${product.price})`,
      color: '#25D366',
      Icon: FaWhatsapp,
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-sm mb-10 hover:text-gold-500 transition-colors"
        style={{ color: 'var(--text-2)' }}
      >
        <ArrowLeft size={16} /> Back to Products
      </Link>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: 'var(--bg-2)' }}>
          <Image
            src={product.image || '/images/placeholder.jpg'}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
          {discount > 0 && (
            <span className="absolute top-4 left-4 bg-gold-500 text-white text-xs font-bold px-3 py-1">
              {discount}% OFF
            </span>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-xs uppercase tracking-[0.3em] mb-2" style={{ color: 'var(--gold)' }}>{product.type}</p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium mb-4" style={{ color: 'var(--text)' }}>
            {product.title}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <span className="font-serif text-3xl font-semibold" style={{ color: 'var(--text)' }}>
              ₹{product.price.toLocaleString('en-IN')}
            </span>
            {product.compareAtPrice > product.price && (
              <span className="text-xl line-through" style={{ color: 'var(--text-2)' }}>
                ₹{product.compareAtPrice.toLocaleString('en-IN')}
              </span>
            )}
            {discount > 0 && (
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">Save {discount}%</span>
            )}
          </div>

          <div className="h-px mb-6" style={{ backgroundColor: 'var(--border)' }} />

          {/* Description */}
          <div
            className="prose prose-sm max-w-none mb-6 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
            dangerouslySetInnerHTML={{ __html: product.description }}
          />

          {/* SKU */}
          <p className="text-xs mb-6" style={{ color: 'var(--text-2)' }}>
            SKU: <span className="font-mono">{product.sku}</span>
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-8">
            {product.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>

          <div className="h-px mb-8" style={{ backgroundColor: 'var(--border)' }} />

          {/* Shop Links */}
          <p className="text-xs uppercase tracking-[0.2em] mb-4 font-medium" style={{ color: 'var(--text)' }}>
            Purchase From
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shopLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 border-2 font-semibold text-sm transition-all hover:scale-[1.02] duration-200"
                style={{ borderColor: l.color, color: l.color }}
              >
                <l.Icon size={16} />
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
