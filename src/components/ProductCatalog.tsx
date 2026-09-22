'use client'

import { useMemo, useState } from 'react'
import { Grid2X2, List } from 'lucide-react'
import type { Product } from '@/lib/types'
import { PRODUCT_CATEGORY_DEFINITIONS, productCategory } from '@/lib/product-categories'
import { ProductCard } from '@/components/ProductCard'

export function ProductCatalog({ products }: { products: Product[] }) {
  const [category, setCategory] = useState<'all' | string>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const availableCategories = useMemo(() => PRODUCT_CATEGORY_DEFINITIONS.filter(definition => products.some(product => productCategory(product) === definition.key)), [products])
  const filtered = category === 'all' ? products : products.filter(product => productCategory(product) === category)

  return (
    <>
      <div className="flex flex-col gap-4 border-y py-4 mb-8" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product categories">
            <button type="button" onClick={() => setCategory('all')} className={`px-4 py-2 text-xs uppercase tracking-widest border ${category === 'all' ? 'bg-gold-500 text-white border-gold-500' : 'border-gold-500 text-gold-600'}`} role="tab" aria-selected={category === 'all'}>All</button>
            {availableCategories.map(definition => <button key={definition.key} type="button" onClick={() => setCategory(definition.key)} className={`px-4 py-2 text-xs uppercase tracking-widest border ${category === definition.key ? 'bg-gold-500 text-white border-gold-500' : 'border-gold-500 text-gold-600'}`} role="tab" aria-selected={category === definition.key}>{definition.label}</button>)}
          </div>
          <div className="flex items-center gap-1 border p-1" style={{ borderColor: 'var(--border)' }} aria-label="Product view">
            <button type="button" onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-gold-500 text-white' : ''}`} style={view === 'grid' ? undefined : { color: 'var(--text-2)' }} aria-label="Grid view" aria-pressed={view === 'grid'}><Grid2X2 size={16} /></button>
            <button type="button" onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-gold-500 text-white' : ''}`} style={view === 'list' ? undefined : { color: 'var(--text-2)' }} aria-label="List view" aria-pressed={view === 'list'}><List size={16} /></button>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-2)' }}>{filtered.length} product{filtered.length === 1 ? '' : 's'} · {category === 'all' ? 'All categories' : availableCategories.find(item => item.key === category)?.label}</p>
      </div>
      <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}>
        {filtered.map(product => <ProductCard key={product.handle} product={product} variant={view} />)}
      </div>
      {filtered.length === 0 && <div className="text-center py-20" style={{ color: 'var(--text-2)' }}><p className="text-lg">No products in this category yet.</p></div>}
    </>
  )
}
