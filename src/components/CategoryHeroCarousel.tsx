'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Product } from '@/lib/types'
import { PRODUCT_CATEGORY_DEFINITIONS, productCategory } from '@/lib/product-categories'

export function CategoryHeroCarousel({ products }: { products: Product[] }) {
  const slides = PRODUCT_CATEGORY_DEFINITIONS.map(definition => ({
    ...definition,
    product: products.find(product => productCategory(product) === definition.key),
  })).filter(slide => slide.product)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const timer = window.setInterval(() => setActive(index => (index + 1) % slides.length), 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null
  const slide = slides[active % slides.length]
  const product = slide.product!
  const images = product.images?.length ? product.images : product.image ? [product.image] : []

  return (
    <div className="relative block">
      <div className="relative min-h-[420px] lg:min-h-[520px] overflow-hidden bg-black">
        {images[0] && <Image key={images[0]} src={images[0]} alt="" fill priority className="object-cover opacity-85 transition-opacity duration-700" sizes="50vw" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-white">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-300 mb-3">{slide.label}</p>
          <p className="max-w-md text-sm text-white/80 mb-6">{slide.description}</p>
          <Link href={`/products/${product.handle}`} className="inline-flex items-center border border-white px-5 py-3 text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-colors">Explore {slide.label}</Link>
        </div>
        {slides.length > 1 && <><button type="button" onClick={() => setActive(index => (index - 1 + slides.length) % slides.length)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/70" aria-label="Previous category"><ChevronLeft size={20} /></button><button type="button" onClick={() => setActive(index => (index + 1) % slides.length)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/70" aria-label="Next category"><ChevronRight size={20} /></button></>}
      </div>
      {slides.length > 1 && <div className="flex justify-center gap-2 mt-4" aria-label="Hero categories">{slides.map((item, index) => <button key={item.key} type="button" onClick={() => setActive(index)} className={`h-1.5 transition-all ${index === active ? 'w-10 bg-gold-500' : 'w-5 bg-gold-300/50'}`} aria-label={`Show ${item.label}`} aria-current={index === active ? 'true' : undefined} />)}</div>}
    </div>
  )
}
