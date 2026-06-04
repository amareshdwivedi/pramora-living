import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Star, Truck, Shield, Package } from 'lucide-react'
import { getProducts } from '@/lib/products'
import { ProductCard } from '@/components/ProductCard'
import { FaAmazon, FaWhatsapp, SiFlipkart, MeeshoIcon } from '@/components/BrandIcons'

export default function HomePage() {
  const products = getProducts().filter(p => p.status === 'active')
  const featured = products.slice(0, 6)

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden" style={{ backgroundColor: 'var(--bg-2)' }}>
        <div className="absolute inset-0 opacity-5 dark:opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, var(--gold) 0, var(--gold) 1px, transparent 0, transparent 50%)',
            backgroundSize: '30px 30px'
          }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--gold)' }}>
              Artisan Home Décor
            </p>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium leading-tight mb-6" style={{ color: 'var(--text)' }}>
              Where Art<br />
              <em className="not-italic" style={{ color: 'var(--gold)' }}>Meets</em><br />
              Home
            </h1>
            <p className="text-base leading-relaxed mb-8 max-w-md" style={{ color: 'var(--text-2)' }}>
              Discover handcrafted sculptures and luxury décor that transform every corner of your home into a statement of refined taste.
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

          {/* Hero product grid */}
          <div className="hidden lg:grid grid-cols-2 gap-3 animate-slide-up">
            {products.slice(0, 4).map((p, i) => (
              <Link key={p.handle} href={`/products/${p.handle}`}
                className={`relative overflow-hidden ${i === 0 ? 'row-span-2' : ''}`}
                style={{ aspectRatio: i === 0 ? '3/4' : '1/1' }}
              >
                <Image src={p.image} alt={p.title} fill className="object-cover hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <span className="absolute bottom-3 left-3 text-white font-serif text-sm font-medium">{p.title}</span>
              </Link>
            ))}
          </div>
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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--gold)' }}>Our Collection</p>
          <h2 className="section-title">Featured Pieces</h2>
          <div className="divider mx-auto" />
          <p className="section-subtitle mx-auto text-center">
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
      <section className="py-20" style={{ backgroundColor: 'var(--bg-2)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="grid grid-cols-2 gap-3">
            {products.slice(4, 8).map(p => (
              <div key={p.handle} className="relative aspect-square overflow-hidden">
                <Image src={p.image} alt={p.title} fill className="object-cover" />
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--gold)' }}>Our Story</p>
            <h2 className="section-title">Crafted with<br />Intention</h2>
            <div className="divider" />
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-2)' }}>
              Pramora Living was born from a passion for preserving India's rich artistic heritage while bringing it into contemporary living spaces.
            </p>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-2)' }}>
              Every sculpture in our collection is a conversation between tradition and modernity — handcrafted by skilled artisans and curated for homes that appreciate the beauty of meaningful objects.
            </p>
            <Link href="/contact" className="btn-gold">
              Connect With Us <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Buy Online CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--gold)' }}>Available Online</p>
        <h2 className="section-title">Shop Your Favourite<br />Platform</h2>
        <div className="divider mx-auto" />
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          {[
            { label: 'Amazon',         href: 'https://amazon.in',      color: '#FF9900', Icon: FaAmazon },
            { label: 'Flipkart',       href: 'https://flipkart.com',   color: '#2874F0', Icon: SiFlipkart },
            { label: 'Meesho',         href: 'https://meesho.com',     color: '#9B2D8E', Icon: MeeshoIcon },
            { label: 'WhatsApp Store', href: 'https://wa.me/919880009575?text=Hi%2C%20I%20want%20to%20order%20from%20Pramora%20Living', color: '#25D366', Icon: FaWhatsapp },
          ].map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-8 py-4 border-2 font-semibold text-sm transition-all hover:scale-105 duration-200"
              style={{ borderColor: s.color, color: s.color }}
            >
              <s.Icon size={16} />
              {s.label}
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
