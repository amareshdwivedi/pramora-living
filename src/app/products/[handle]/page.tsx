import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProduct, getProducts } from '@/lib/products'
import { FaWhatsapp, AmazonBadge } from '@/components/BrandIcons'
import { amazonProductUrl } from '@/lib/amazon/url'
import { whatsappUrl, SITE_URL } from '@/lib/contact'

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
  const amazonUrl = amazonProductUrl(product)
  const whatsappHelpUrl = whatsappUrl(
    `Hi Pramora Living I need help regarding the ${product.title} ${SITE_URL}/products/${product.handle}`,
  )

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

          {/* Primary CTAs — Buy on Amazon (deep-link to this listing) + WhatsApp help */}
          <div className="flex flex-col items-start gap-3 mb-6">
            {amazonUrl && (
              <a
                href={amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Buy ${product.title} now on Amazon`}
                className="group inline-flex items-center gap-4 rounded-lg pl-5 pr-4 py-3 transition-all hover:scale-[1.02] hover:shadow-lg"
                style={{ backgroundColor: '#FF9900' }}
              >
                <span className="font-semibold text-sm" style={{ color: '#131921' }}>Buy Now on</span>
                <AmazonBadge height={40} />
              </a>
            )}

            <a
              href={whatsappHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chat on WhatsApp about ${product.title}`}
              className="inline-flex items-center gap-3 rounded-lg px-5 py-3 font-semibold text-sm text-white transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{ backgroundColor: '#25D366' }}
            >
              <FaWhatsapp size={22} />
              Available on WhatsApp
            </a>

            <p className="text-xs" style={{ color: 'var(--text-2)' }}>
              Checkout securely on Amazon, or chat with us on WhatsApp for help with this item.
            </p>
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
          <div className="flex flex-wrap gap-2">
            {product.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
