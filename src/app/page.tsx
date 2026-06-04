import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getProducts } from '@/lib/products'
import { ProductCard } from '@/components/ProductCard'

export default function HomePage() {
  const products = getProducts().filter(p => p.status === 'active')

  return (
    <>
      {/* ── Hero ─────────────────────────────────── */}
      <section className="container-craft pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text */}
          <div>
            <p className="overline mb-6">Artisan Home Décor</p>
            <h1 className="display-heading mb-6">
              Objects made<br />
              <em>with intention</em>
            </h1>
            <p className="body-text max-w-md mb-10 text-base leading-relaxed">
              Each piece in our collection is handcrafted by skilled artisans — sculptures, figurines, and décor that carry meaning, heritage, and quiet beauty into your home.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/products" className="btn-primary">
                Shop the Collection
              </Link>
              <Link href="/contact" className="btn-secondary">
                Get in Touch
              </Link>
            </div>
          </div>

          {/* Hero image mosaic */}
          <div className="grid grid-cols-2 gap-3">
            <div className="img-hover relative aspect-[2/3] col-span-1">
              <Image src={products[0]?.image || ''} alt={products[0]?.title || ''} fill className="object-cover" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="img-hover relative aspect-square">
                <Image src={products[1]?.image || ''} alt={products[1]?.title || ''} fill className="object-cover" />
              </div>
              <div className="img-hover relative aspect-square">
                <Image src={products[2]?.image || ''} alt={products[2]?.title || ''} fill className="object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Thin rule ─────────────────────────────── */}
      <div className="container-craft"><div className="h-px w-full" style={{ backgroundColor: 'var(--border)' }} /></div>

      {/* ── Featured Products ─────────────────────── */}
      <section className="container-craft py-20 md:py-28">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="overline mb-3">Our Collection</p>
            <h2 className="font-serif text-3xl md:text-4xl" style={{ color: 'var(--text)' }}>Featured Pieces</h2>
          </div>
          <Link
            href="/products"
            className="text-2xs uppercase tracking-widest flex items-center gap-2 transition-opacity hover:opacity-50 font-medium flex-shrink-0"
            style={{ color: 'var(--text-2)' }}
          >
            View All <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
          {products.slice(0, 6).map(p => <ProductCard key={p.handle} product={p} />)}
        </div>
      </section>

      {/* ── Full-bleed story band ──────────────────── */}
      <section style={{ backgroundColor: 'var(--bg-2)' }}>
        <div className="container-craft py-20 md:py-28 grid lg:grid-cols-2 gap-16 items-center">
          <div className="grid grid-cols-2 gap-3">
            {products.slice(3, 7).map(p => (
              <div key={p.handle} className="img-hover relative aspect-square">
                <Image src={p.image} alt={p.title} fill className="object-cover" />
              </div>
            ))}
          </div>
          <div>
            <p className="overline mb-6">Our Story</p>
            <h2 className="font-serif text-3xl md:text-4xl mb-6" style={{ color: 'var(--text)' }}>
              Celebrating the art<br />of making things by hand
            </h2>
            <div className="rule" />
            <p className="body-text mb-4">
              Pramora Living was born from a deep respect for India's rich craft traditions. We believe the objects we surround ourselves with should be more than decorative — they should carry stories, skill, and soul.
            </p>
            <p className="body-text mb-10">
              Every sculpture is made by hand, chosen for its quality, and delivered to homes that appreciate the beauty of meaningful things.
            </p>
            <Link href="/contact" className="btn-secondary">
              Connect With Us
            </Link>
          </div>
        </div>
      </section>

      {/* ── Buy Online ────────────────────────────── */}
      <section className="container-craft py-20 md:py-28 text-center">
        <p className="overline mb-4">Available Online</p>
        <h2 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: 'var(--text)' }}>
          Shop on your favourite platform
        </h2>
        <div className="rule mx-auto" />
        <p className="body-text max-w-sm mx-auto mb-12">
          Find Pramora Living pieces across all major marketplaces and order directly on WhatsApp.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {[
            { label: 'Amazon',        href: 'https://amazon.in',      dot: '#FF9900' },
            { label: 'Flipkart',      href: 'https://flipkart.com',   dot: '#2874F0' },
            { label: 'Meesho',        href: 'https://meesho.com',     dot: '#9B2D8E' },
            { label: 'WhatsApp Store',href: 'https://wa.me/919880009575?text=Hi%2C%20I%20want%20to%20order%20from%20Pramora%20Living', dot: '#25D366' },
          ].map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary gap-3"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
              {s.label}
            </a>
          ))}
        </div>
      </section>

      {/* ── All Products strip ────────────────────── */}
      <section style={{ backgroundColor: 'var(--bg-2)' }}>
        <div className="container-craft py-20">
          <p className="overline text-center mb-10">The Full Collection</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
            {products.map(p => <ProductCard key={p.handle} product={p} />)}
          </div>
        </div>
      </section>
    </>
  )
}
