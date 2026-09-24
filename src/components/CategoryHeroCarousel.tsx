'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Product } from '@/lib/types'
import { PRODUCT_CATEGORY_DEFINITIONS, productCategory } from '@/lib/product-categories'

type CuratedSlide = { id: string; product: Product; imageUrl: string }

export function CategoryHeroCarousel({ products, curatedSlides = [] }: { products: Product[]; curatedSlides?: CuratedSlide[] }) {
  const categorySlides = PRODUCT_CATEGORY_DEFINITIONS.map(definition => ({
    ...definition,
    product: products.find(product => productCategory(product) === definition.key),
  })).filter(slide => slide.product)
  const slides = curatedSlides.length > 0
    ? curatedSlides.map(slide => ({ key: slide.id, label: slide.product.type || 'Featured Piece', description: slide.product.title, product: slide.product, imageUrl: slide.imageUrl }))
    : categorySlides.map(slide => ({ ...slide, imageUrl: slide.product?.images?.[0] || slide.product?.image || '' }))
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const timer = window.setInterval(() => setActive(index => (index + 1) % slides.length), 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null
  const slide = slides[active % slides.length]
  const product = slide.product!

  return (
    <div className="relative block">
      <div className="relative isolate h-[460px] lg:h-[560px]">
        {slides.map((item, index) => {
          const distance = (index - active + slides.length) % slides.length
          const position = distance === 0 ? 'front' : distance === 1 ? 'next' : distance === 2 ? 'far' : distance === slides.length - 1 ? 'previous' : 'hidden'
          return (
            <div key={item.key} className="hero-stack-card" data-position={position} aria-hidden={distance !== 0}>
              {item.imageUrl && <Image src={item.imageUrl} alt={distance === 0 ? item.product?.title ?? '' : ''} fill priority={index === 0} className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
            </div>
          )
        })}
        <div key={slide.key} className="hero-stack-caption absolute bottom-10 left-0 right-10 z-40 p-8 text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-300 mb-3">{slide.label}</p>
            <p className="max-w-md text-sm text-white/80 mb-6">{slide.description}</p>
            <Link href={`/products/${product.handle}`} className="inline-flex items-center border border-white px-5 py-3 text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-colors">{curatedSlides.length > 0 ? 'View Piece' : `Explore ${slide.label}`}</Link>
        </div>
        {slides.length > 1 && <div className="pointer-events-none absolute bottom-10 left-0 right-10 top-0 z-50">
          <button type="button" onClick={() => setActive(index => (index - 1 + slides.length) % slides.length)} className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/70" aria-label="Previous category"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => setActive(index => (index + 1) % slides.length)} className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/70" aria-label="Next category"><ChevronRight size={20} /></button>
        </div>}
      </div>
      {slides.length > 1 && <div className="flex justify-center gap-2 mt-4" aria-label="Hero categories">{slides.map((item, index) => <button key={item.key} type="button" onClick={() => setActive(index)} className={`h-1.5 transition-all ${index === active ? 'w-10 bg-gold-500' : 'w-5 bg-gold-300/50'}`} aria-label={`Show ${item.label}`} aria-current={index === active ? 'true' : undefined} />)}</div>}
    </div>
  )
}
