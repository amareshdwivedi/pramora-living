'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Save, Search, Star } from 'lucide-react'
import { ProductOrderList } from '@/components/admin/ProductOrderList'
import { orderProducts } from '@/lib/site-layout'
import type { Product, SiteLayout } from '@/lib/types'

const MAX_FEATURED = 6

export default function FeaturedItemsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [draft, setDraft] = useState<string[] | null>(null)
  const [saved, setSaved] = useState<string[] | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setNotice('')
    try {
      const response = await fetch('/api/admin/layout', { cache: 'no-store' })
      if (response.status === 401) { router.replace('/admin'); return }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load featured items.')
      const active = (data.products as Product[]).filter(product => product.status === 'active')
      const layout = data.layout as SiteLayout
      const ordered = orderProducts(active, layout.catalogOrder)
      const activeIds = new Set(ordered.map(product => product.id))
      const ids = layout.featuredOrder.length
        ? layout.featuredOrder.filter(id => activeIds.has(id))
        : ordered.slice(0, MAX_FEATURED).map(product => product.id)
      setProducts(ordered)
      setDraft(ids)
      setSaved(ids)
      setReady(Boolean(data.ready))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load featured items.')
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!draft || !ready || draft.length === 0) return
    const ids = [...draft]
    setSaving(true)
    setNotice('')
    try {
      const response = await fetch('/api/admin/layout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'featuredOrder', value: ids }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save featured items.')
      setSaved(ids)
      setNotice('Featured items saved. The homepage will use this order.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save featured items.')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-16" role="status">Loading featured items…</div>
  if (!draft || !saved) return <div className="max-w-6xl mx-auto px-4 py-16"><p role="alert">{notice || 'Could not load featured items.'}</p><Link href="/admin" className="btn-outline mt-6">Back to Admin</Link></div>

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const available = products.filter(product => !draft.includes(product.id) && product.title.toLowerCase().includes(search.trim().toLowerCase()))
  const addProduct = (id: string) => setDraft(previous => previous && previous.length < MAX_FEATURED && !previous.includes(id) ? [...previous, id] : previous)

  return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
    <Link href="/admin" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: 'var(--text-2)' }}><ArrowLeft size={16} /> Back to Product Manager</Link>
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div><p className="label">Homepage merchandising</p><h1 className="font-serif text-3xl">Featured Items</h1><p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--text-2)' }}>Choose up to six active products and set the order they appear in the homepage Featured Pieces section.</p></div>
      <Link href="/" target="_blank" className="btn-outline">View homepage</Link>
    </div>

    {notice && <div role="status" className="mb-6 border-l-4 p-4 text-sm" style={{ borderColor: 'var(--gold)', background: 'var(--bg-2)' }}>{notice}</div>}
    {!ready && <div role="status" className="mb-6 border-l-4 p-4 text-sm" style={{ borderColor: 'var(--gold)', background: 'var(--bg-2)' }}>Read-only preview: the layout database table is not installed, so saving is disabled.</div>}

    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
      <section aria-label="Selected featured items">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div><h2 className="font-serif text-2xl">Selected items</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{draft.length} of {MAX_FEATURED} selected · Drag to reorder, or use the move buttons.</p></div><Star size={22} style={{ color: 'var(--gold)' }} aria-hidden="true" /></div>
        {draft.length > 0 ? <ProductOrderList ids={draft} products={products} onChange={setDraft} onRemove={id => setDraft(previous => previous?.filter(item => item !== id) ?? null)} minLength={1} /> : <div className="card p-8 text-sm" style={{ color: 'var(--text-2)' }}>Choose a product from the list to get started.</div>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setDraft(saved)} disabled={!dirty || saving} className="btn-outline disabled:opacity-50">Discard changes</button>
          <button type="button" onClick={() => void save()} disabled={!ready || !dirty || draft.length === 0 || saving} className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"><Save size={16} /> {saving ? 'Saving…' : 'Save Featured Items'}</button>
        </div>
      </section>

      <section aria-label="Available products">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div><h2 className="font-serif text-2xl">Available products</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Add an active product to the featured row.</p></div></div>
        <label htmlFor="featured-search" className="sr-only">Search available products</label>
        <div className="relative mb-4"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-2)' }} aria-hidden="true" /><input id="featured-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products" className="input pl-10" /></div>
        <div className="space-y-2 max-h-[34rem] overflow-y-auto pr-1">
          {available.map(product => <div key={product.id} className="card flex items-center gap-3 p-3"><div className="relative h-14 w-14 shrink-0" style={{ background: 'var(--bg-2)' }}>{product.image && <Image src={product.image} alt="" fill className="object-contain p-1" sizes="56px" />}</div><span className="min-w-0 flex-1 text-sm line-clamp-2" style={{ color: 'var(--text)' }}>{product.title}</span><button type="button" onClick={() => addProduct(product.id)} disabled={draft.length >= MAX_FEATURED || saving} className="p-2 disabled:opacity-30" aria-label={`Add ${product.title} to featured items`} title="Add to featured items"><Plus size={18} /></button></div>)}
          {available.length === 0 && <p className="card p-6 text-sm" style={{ color: 'var(--text-2)' }}>{search ? 'No matching products available.' : 'All active products are selected.'}</p>}
        </div>
      </section>
    </div>
  </div>
}
