import Link from 'next/link'
import { ArrowRight, Star, Truck, Shield, Package } from 'lucide-react'
import { getProducts } from '@/lib/products'
import { ProductCard } from '@/components/ProductCard'
import { ProductImageCarousel } from '@/components/ProductImageCarousel'
import { CategoryHeroCarousel } from '@/components/CategoryHeroCarousel'
import { getSiteLayout } from '@/lib/db/site-layout.repo'
import { orderProducts, selectedProducts } from '@/lib/site-layout'

export default async function HomePage() {
  const [allProducts, layout] = await Promise.all([getProducts(), getSiteLayout()])
  const products = orderProducts(allProducts.filter(p => p.status === 'active'), layout.catalogOrder)
  const featured = selectedProducts(products, layout.featuredOrder, products, 6)
  const story = selectedProducts(products, layout.storyOrder, products.slice(4, 8), 4)
  const byId = new Map(products.map(product => [product.id, product]))
  const heroSlides = layout.heroSlides.filter(slide => slide.enabled).flatMap(slide => {
    const product = byId.get(slide.productId)
    if (!product) return []
    const imageUrl = slide.imageUrl.startsWith('/api/hero-image?url=') || [product.image, ...(product.images ?? [])].includes(slide.imageUrl)
      ? slide.imageUrl : product.image
    return imageUrl ? [{ id: slide.id, product, imageUrl }] : []
  })

  return (
    <>
      {/* Hero */}
      <section className="home-hero relative min-h-[85vh] flex items-center overflow-hidden" style={{ backgroundColor: 'var(--bg-2)' }}>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--gold)' }}>
              Artisan-Made Pieces
            </p>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium leading-tight mb-6" style={{ color: 'var(--text)' }}>
              Where Art<br />
              <em className="not-italic" style={{ color: 'var(--gold)' }}>Meets</em><br />
              Home
            </h1>
            <p className="text-base leading-relaxed mb-8 max-w-md" style={{ color: 'var(--text-2)' }}>
              Discover thoughtfully handcrafted pieces made by skilled artisans, using natural materials and conscious design to bring warmth, character, and meaning into your home.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/products" className="btn-gold">
                Explore Collection <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="btn-outline">
                Get in Touch
              </Link>
            </div>
          </div>

          <CategoryHeroCarousel products={products} curatedSlides={heroSlides} />
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-y py-6" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: Star, label: 'Premium Quality', sub: 'Handpicked artisan pieces' },
            { icon: Truck, label: 'Pan-India Delivery', sub: 'Fast & secure shipping' },
            { icon: Shield, label: 'Authentic Crafts', sub: '100% genuine artistry' },
            { icon: Package, label: 'Gift Ready', sub: 'Elegant packaging' },
          ].map(b => (
            <div key={b.label} className="flex flex-col items-center gap-2">
              <b.icon size={20} style={{ color: 'var(--gold)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{b.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>{b.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-16" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] mb-2" style={{ color: 'var(--gold)' }}>Our Collection</p>
          <h2 className="section-title">Featured Pieces</h2>
          <div className="divider mx-auto mb-4" />
          <p className="section-subtitle mx-auto max-w-none text-center text-sm sm:text-base mb-0 lg:whitespace-nowrap">
            Each piece is carefully selected to bring beauty, meaning, and artisan excellence into your home.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map(p => <ProductCard key={p.handle} product={p} />)}
        </div>
        <div className="text-center mt-10">
          <Link href="/products" className="btn-outline">
            View All Products <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Story section */}
      <section className="home-story-flow py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="grid grid-cols-2 gap-3">
            {story.map(p => (
              <Link key={p.handle} href={`/products/${p.handle}`} className="relative aspect-square overflow-hidden block focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500">
                <ProductImageCarousel
                  images={p.images?.length ? p.images : p.image ? [p.image] : []}
                  alt={p.title}
                  showNavigation={false}
                />
              </Link>
            ))}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--gold)' }}>Our Story</p>
            <h2 className="section-title">Crafted with<br />Intention</h2>
            <div className="divider" />
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-2)' }}>
              We bring together artisan craftsmanship, natural materials, and responsible design to create pieces that feel beautiful, meaningful, and made to last.
            </p>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-2)' }}>
              Each piece is thoughtfully chosen for homes that value natural character, conscious living, and the enduring beauty of work made by hand.
            </p>
            <Link href="/contact" className="btn-gold">
              Connect With Us <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

    </>
  )
}
