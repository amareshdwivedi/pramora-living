'use client'

import { useState } from 'react'
import type { ProductReview } from '@/lib/types'

const REVIEWS_PER_PAGE = 4

export function CustomerReviews({ reviews }: { reviews: ProductReview[] }) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * REVIEWS_PER_PAGE
  const visibleReviews = reviews.slice(start, start + REVIEWS_PER_PAGE)

  return (
    <section className="mt-6 rounded-xl border p-5 sm:p-7" aria-labelledby="customer-reviews" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="customer-reviews" className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>Customer Reviews</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
        {visibleReviews.map(review => (
          <article key={review.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{review.name}</p>
              <span className="text-sm tracking-wide text-amber-500" aria-label={`${review.rating} out of 5 stars`}>
                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{review.text}</p>
          </article>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs" style={{ color: 'var(--text-2)' }} aria-live="polite">
          Showing {reviews.length === 0 ? 0 : start + 1}–{Math.min(start + REVIEWS_PER_PAGE, reviews.length)} of {reviews.length} reviews · Page {currentPage} of {pageCount}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-outline px-3 py-2 text-sm" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Previous reviews page">
            Previous
          </button>
          <button type="button" className="btn-outline px-3 py-2 text-sm" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="Next reviews page">
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
