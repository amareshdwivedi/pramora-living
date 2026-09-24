import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProduct, getProducts } from '@/lib/products'
import { FaAmazon, FaWhatsapp, SiFlipkart, MeeshoIcon } from '@/components/BrandIcons'
import { amazonProductUrl } from '@/lib/amazon/url'
import { whatsappUrl, SITE_URL } from '@/lib/contact'
import { ProductImageCarousel } from '@/components/ProductImageCarousel'
import { CustomerReviews } from '@/components/CustomerReviews'

// Render product pages on demand and keep them fresh; new items created by an
// Amazon sync are served without a rebuild.
export const dynamicParams = true
export const revalidate = 60

const BUY_BUTTON_CLASS = 'group inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-0.5 py-2 text-[11px] font-semibold sm:px-2 sm:text-xs'
const BUY_BUTTON_CONTENT_CLASS = 'inline-flex items-center gap-1 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none sm:gap-2'

export async function generateStaticParams() {
  return (await getProducts()).map(p => ({ handle: p.handle }))
}

export default async function ProductPage({ params }: { params: { handle: string } }) {
  const product = await getProduct(params.handle)
  if (!product) notFound()

  const discount = Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
  const marketplaceLinks = [
    { name: 'Amazon', href: amazonProductUrl(product) || 'https://www.amazon.in', Icon: FaAmazon, backgroundColor: '#FF9900', color: '#131921' },
    { name: 'Flipkart', href: product.flipkartUrl?.trim() || 'https://www.flipkart.com', Icon: SiFlipkart, backgroundColor: '#2874F0', color: '#FFFFFF' },
    { name: 'Meesho', href: product.meeshoUrl?.trim() || 'https://www.meesho.com', Icon: MeeshoIcon, backgroundColor: '#5F1E8F', color: '#FFFFFF' },
  ]
  const images = product.images?.length ? product.images : product.image ? [product.image] : []
  const whatsappHelpUrl = whatsappUrl(
    `Hi Pramora Living I need help regarding the ${product.title} ${SITE_URL}/products/${product.handle}`,
  )

  return (
    <section className="home-hero min-h-screen" style={{ backgroundColor: 'var(--bg-2)' }}>
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
        <div>
          <div className="relative">
            <ProductImageCarousel images={images} alt={product.title} showThumbnails enableLightbox />
            {discount > 0 && (
              <span className="absolute top-4 left-4 text-white text-xs font-bold px-3 py-1" style={{ backgroundColor: 'var(--orange)' }}>
                {discount}% OFF
              </span>
            )}
          </div>

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
          <p className="text-xs mb-4" style={{ color: 'var(--text-2)' }}>
            SKU: <span className="font-mono">{product.sku}</span>
          </p>

          {/* Marketplace links and WhatsApp help */}
          <div className="overflow-x-auto">
            <div className="grid min-w-[288px] grid-cols-4 gap-1.5 sm:gap-2">
              {marketplaceLinks.map(({ name, href, Icon, backgroundColor, color }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Buy Now on ${name}`}
                  title={name}
                  className={BUY_BUTTON_CLASS}
                  style={{ backgroundColor, color }}
                >
                  <span className={BUY_BUTTON_CONTENT_CLASS}><Icon size={16} />Buy Now</span>
                </a>
              ))}

              <a
                href={whatsappHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Chat on WhatsApp about ${product.title}`}
                className={BUY_BUTTON_CLASS}
                style={{ backgroundColor: '#25D366', color: '#FFFFFF' }}
              >
                <span className={BUY_BUTTON_CONTENT_CLASS}><FaWhatsapp size={16} />Buy Now</span>
              </a>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-6">
            {product.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>

        </div>
      </div>

      {product.aboutItem.length > 0 && (
        <section className="mt-10 rounded-xl border p-5 sm:p-7" aria-labelledby="about-this-item" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <h2 id="about-this-item" className="font-serif text-xl font-medium mb-3" style={{ color: 'var(--text)' }}>About this item</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {product.aboutItem.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ul>
        </section>
      )}
      <CustomerReviews key={product.handle} reviews={product.reviews ?? []} />
      </div>
    </section>
  )
}
