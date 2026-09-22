'use client'

import Image from 'next/image'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type ProductImageCarouselProps = {
  images: string[]
  alt: string
  className?: string
  frameClassName?: string
  showThumbnails?: boolean
  enableLightbox?: boolean
  showNavigation?: boolean
}

export function ProductImageCarousel({
  images,
  alt,
  className = '',
  frameClassName = 'aspect-square',
  showThumbnails = false,
  enableLightbox = false,
  showNavigation = true,
}: ProductImageCarouselProps) {
  const usableImages = images.filter(Boolean)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (!lightboxOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false)
      if (event.key === 'ArrowLeft') setActiveIndex(index => (index - 1 + usableImages.length) % usableImages.length)
      if (event.key === 'ArrowRight') setActiveIndex(index => (index + 1) % usableImages.length)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxOpen, usableImages.length])

  const move = (direction: -1 | 1) => {
    setActiveIndex(index => (index + direction + usableImages.length) % usableImages.length)
  }

  if (usableImages.length === 0) {
    return (
      <div className={`relative ${frameClassName} flex items-center justify-center ${className}`} style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text-2)' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    )
  }

  const activeImage = usableImages[activeIndex]

  return (
    <>
      <div className={`relative ${frameClassName} overflow-hidden ${className}`} style={{ backgroundColor: 'var(--bg-2)' }}>
        <div
          className={`absolute inset-0 z-0 ${enableLightbox ? 'cursor-zoom-in' : ''}`}
          onClick={enableLightbox ? () => setLightboxOpen(true) : undefined}
          onKeyDown={enableLightbox ? event => {
            if (event.key === 'Enter' || event.key === ' ') setLightboxOpen(true)
          } : undefined}
          role={enableLightbox ? 'button' : undefined}
          tabIndex={enableLightbox ? 0 : undefined}
          aria-label={enableLightbox ? `View ${alt} image full size` : undefined}
        >
          <Image
            src={activeImage}
            alt={`${alt} image ${activeIndex + 1}`}
            fill
            className="object-contain p-2"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={activeIndex === 0}
          />
        </div>

        {showNavigation && usableImages.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/70"
              onClick={event => { event.stopPropagation(); move(-1) }}
              aria-label="Previous product image"
              title="Previous image"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/70"
              onClick={event => { event.stopPropagation(); move(1) }}
              aria-label="Next product image"
              title="Next image"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {enableLightbox && (
          <button
            type="button"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/70"
            onClick={event => { event.stopPropagation(); setLightboxOpen(true) }}
            aria-label="Open full-size image"
            title="View full image"
          >
            <Maximize2 size={15} />
          </button>
        )}
      </div>

      {showThumbnails && usableImages.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {usableImages.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-square overflow-hidden border-2 ${index === activeIndex ? 'border-gold-500' : 'border-transparent'}`}
              style={{ backgroundColor: 'var(--bg-2)' }}
              aria-label={`View image ${index + 1}`}
            >
              <Image src={image} alt={`${alt} thumbnail ${index + 1}`} fill className="object-contain p-1" sizes="15vw" />
            </button>
          ))}
        </div>
      )}

      {enableLightbox && lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} full-size image viewer`}
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative h-full w-full max-w-6xl" onClick={event => event.stopPropagation()}>
            <Image src={activeImage} alt={`${alt} full-size image ${activeIndex + 1}`} fill className="object-contain" sizes="100vw" priority />
            {usableImages.length > 1 && (
              <>
                <button type="button" className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:left-5" onClick={() => move(-1)} aria-label="Previous full-size image" title="Previous image">
                  <ChevronLeft size={26} />
                </button>
                <button type="button" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:right-5" onClick={() => move(1)} aria-label="Next full-size image" title="Next image">
                  <ChevronRight size={26} />
                </button>
              </>
            )}
            <button type="button" className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:right-5 sm:top-5" onClick={() => setLightboxOpen(false)} aria-label="Close full-size image viewer" title="Close">
              <X size={22} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
