'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import type { HeroSlide, Product, SiteLayout } from '@/lib/types'
import { orderProducts } from '@/lib/site-layout'
import { ProductOrderList } from '@/components/admin/ProductOrderList'

type Section = 'catalogOrder' | 'featuredOrder' | 'storyOrder' | 'heroSlides'
type Tab = 'catalog' | 'home' | 'hero'

function move<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items
  const copy = [...items]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

function productImages(product: Product): string[] {
  return [...new Set([product.image, ...(product.images ?? [])].filter(Boolean))]
}

export default function AdminLayoutPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('catalog')
  const [products, setProducts] = useState<Product[]>([])
  const [draft, setDraft] = useState<SiteLayout | null>(null)
  const [saved, setSaved] = useState<SiteLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [layoutReady, setLayoutReady] = useState(false)
  const [uploadReady, setUploadReady] = useState(false)
  const [saving, setSaving] = useState<Section | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [draggedSlide, setDraggedSlide] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/layout')
      if (response.status === 401) { router.replace('/admin'); return }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load page layout.')
      const active = (data.products as Product[]).filter(product => product.status === 'active')
      const layout = data.layout as SiteLayout
      const ordered = orderProducts(active, layout.catalogOrder)
      const suggestedSlides = ordered.filter(product => productImages(product).length > 0).slice(0, 5).map(product => ({
        id: crypto.randomUUID(), productId: product.id, imageUrl: productImages(product)[0], enabled: true,
      }))
      const initial: SiteLayout = {
        catalogOrder: ordered.map(product => product.id),
        featuredOrder: layout.featuredOrder.length ? layout.featuredOrder.filter(id => active.some(product => product.id === id)) : ordered.slice(0, 6).map(product => product.id),
        storyOrder: layout.storyOrder.length ? layout.storyOrder.filter(id => active.some(product => product.id === id)) : ordered.slice(4, 8).map(product => product.id),
        heroSlides: layout.heroSlides.length ? layout.heroSlides : suggestedSlides,
      }
      setProducts(active)
      setLayoutReady(Boolean(data.ready))
      setUploadReady(Boolean(data.uploadReady))
      setDraft(initial)
      setSaved({ ...initial, heroSlides: layout.heroSlides })
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load page layout.') }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { void load() }, [load])

  const setSection = <K extends Section>(section: K, value: SiteLayout[K]) => setDraft(previous => previous ? { ...previous, [section]: value } : previous)
  const dirty = (section: Section) => JSON.stringify(draft?.[section]) !== JSON.stringify(saved?.[section])
  const save = async (section: Section) => {
    if (!draft || !layoutReady) return
    setSaving(section); setNotice('')
    try {
      const response = await fetch('/api/admin/layout', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section, value: draft[section] }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save layout.')
      setSaved(previous => previous ? { ...previous, [section]: draft[section] } : previous)
      setNotice('Saved. The storefront will use this layout.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save layout.') }
    finally { setSaving(null) }
  }

  const addProduct = (section: 'featuredOrder' | 'storyOrder', id: string) => {
    if (!draft || !id || draft[section].includes(id)) return
    setSection(section, [...draft[section], id])
  }

  const addSlide = () => {
    if (!draft || draft.heroSlides.length >= 5) return
    const product = products.find(item => productImages(item).length > 0)
    if (!product) { setNotice('Add a product image before creating a hero slide.'); return }
    setSection('heroSlides', [...draft.heroSlides, { id: crypto.randomUUID(), productId: product.id, imageUrl: productImages(product)[0], enabled: true }])
  }

  const changeSlide = (id: string, update: Partial<HeroSlide>) => {
    if (!draft) return
    setSection('heroSlides', draft.heroSlides.map(slide => slide.id === id ? { ...slide, ...update } : slide))
  }

  const uploadImage = async (id: string, file: File) => {
    if (!layoutReady) return
    setUploading(id); setNotice('')
    try {
      const form = new FormData(); form.append('file', file)
      const response = await fetch('/api/admin/hero-image', { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Upload failed.')
      changeSlide(id, { imageUrl: data.url })
      setNotice('Image uploaded. Save Hero Banner to publish it.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Upload failed.') }
    finally { setUploading(null) }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-16" role="status">Loading page layout…</div>
  if (!draft) return <div className="max-w-6xl mx-auto px-4 py-16"><p>{notice || 'Could not load page layout.'}</p><Link href="/admin" className="btn-outline mt-6">Back to Admin</Link></div>

  const byId = new Map(products.map(product => [product.id, product]))
  const sectionButton = (section: Section, label: string) => <button type="button" onClick={() => void save(section)} disabled={!layoutReady || saving !== null || (section === 'heroSlides' && uploading !== null) || !dirty(section)} className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"><Save size={15} /> {saving === section ? 'Saving…' : label}</button>
  const sectionControls = (section: Section, label: string) => <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSection(section, saved![section])} disabled={!dirty(section)} className="btn-outline disabled:opacity-50">Discard</button>{sectionButton(section, label)}</div>

  return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
    <Link href="/admin" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: 'var(--text-2)' }}><ArrowLeft size={16} /> Back to Product Manager</Link>
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8"><div><p className="label">Storefront merchandising</p><h1 className="font-serif text-3xl">Page Layout</h1><p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>Choose what appears first on the homepage, in the hero banner, and in the catalog.</p></div><button type="button" onClick={() => void load()} className="btn-outline">Reload saved layout</button></div>
    {notice && <div role="status" className="mb-6 border-l-4 p-4 text-sm" style={{ borderColor: 'var(--gold)', background: 'var(--bg-2)' }}>{notice}</div>}
    {!layoutReady && <div role="status" className="mb-6 border-l-4 p-4 text-sm" style={{ borderColor: 'var(--gold)', background: 'var(--bg-2)' }}>Read-only preview: the layout database table is not installed. Reordering can be explored here, but saving and banner uploads are disabled until a development database is confirmed and migrated.</div>}
    <div className="flex flex-wrap gap-2 border-b mb-8" style={{ borderColor: 'var(--border)' }} role="group" aria-label="Layout section">
      {([{ id: 'catalog', label: 'All Products Order' }, { id: 'home', label: 'Homepage' }, { id: 'hero', label: 'Hero Banner' }] as const).map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className="px-4 py-3 text-sm font-medium border-b-2" style={{ borderColor: tab === item.id ? 'var(--gold)' : 'transparent', color: tab === item.id ? 'var(--gold)' : 'var(--text-2)' }}>{item.label}</button>)}
    </div>

    {tab === 'catalog' && <section aria-label="All Products Order">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-5"><div><h2 className="font-serif text-2xl">All Products Order</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Drag rows to reorder. Move buttons also work on touchscreens and keyboards. Draft products appear after they are published.</p></div>{sectionControls('catalogOrder', 'Save Catalog Order')}</div>
      <ProductOrderList ids={draft.catalogOrder} products={products} onChange={ids => setSection('catalogOrder', ids)} />
      <div className="flex justify-end mt-5">{sectionButton('catalogOrder', 'Save Catalog Order')}</div>
    </section>}

    {tab === 'home' && <div className="space-y-12">
      {([{ section: 'featuredOrder', title: 'Featured Pieces', max: 6 }, { section: 'storyOrder', title: 'Story Images', max: 4 }] as const).map(config => {
        const ids = draft[config.section]
        return <section key={config.section} aria-label={config.title}>
          <div className="flex flex-wrap justify-between items-center gap-4 mb-5"><div><h2 className="font-serif text-2xl">{config.title}</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Choose and reorder up to {config.max} active products.</p>{config.section === 'featuredOrder' && <Link href="/admin/featured" className="inline-block text-sm underline mt-2" style={{ color: 'var(--gold)' }}>Open Featured Items workspace</Link>}</div>{sectionControls(config.section, `Save ${config.title}`)}</div>
          <ProductOrderList ids={ids} products={products} onChange={next => setSection(config.section, next)} onRemove={id => setSection(config.section, ids.filter(item => item !== id))} minLength={1} />
          {ids.length < config.max && <div className="flex items-center gap-2 mt-4"><Plus size={16} /><label htmlFor={`add-${config.section}`} className="sr-only">Add a product to {config.title}</label><select id={`add-${config.section}`} className="input max-w-md" value="" onChange={event => addProduct(config.section, event.target.value)}><option value="">Add a product…</option>{products.filter(product => !ids.includes(product.id)).map(product => <option key={product.id} value={product.id}>{product.title}</option>)}</select></div>}
        </section>
      })}
    </div>}

    {tab === 'hero' && <section aria-label="Hero Banner">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5"><div><h2 className="font-serif text-2xl">Hero Banner</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Build a carousel of four or five images. Select a product image or upload a banner image, then drag slides into order.</p></div><div className="flex flex-wrap gap-3"><button type="button" onClick={addSlide} disabled={draft.heroSlides.length >= 5} className="btn-outline disabled:opacity-50"><Plus size={16} /> Add Slide</button>{sectionControls('heroSlides', 'Save Hero Banner')}</div></div>
      {draft.heroSlides.length === 0 && <div className="card p-10 text-center text-sm" style={{ color: 'var(--text-2)' }}>No slides configured. The current category carousel remains visible until you save your first slide.</div>}
      <ol className="space-y-5">
        {draft.heroSlides.map((slide, index) => {
          const product = byId.get(slide.productId)
          const images = product ? productImages(product) : []
          const uploaded = !images.includes(slide.imageUrl)
          return <li key={slide.id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (draggedSlide) setSection('heroSlides', move(draft.heroSlides, draft.heroSlides.findIndex(item => item.id === draggedSlide), index)); setDraggedSlide(null) }} className="card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4"><span draggable onDragStart={event => { setDraggedSlide(slide.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', slide.id) }} onDragEnd={() => setDraggedSlide(null)} className="cursor-grab" title="Drag to reorder"><GripVertical size={18} aria-hidden="true" /></span><span className="text-sm font-semibold flex-1">Slide {index + 1}</span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slide.enabled} onChange={event => changeSlide(slide.id, { enabled: event.target.checked })} /> Enabled</label><button type="button" onClick={() => setSection('heroSlides', move(draft.heroSlides, index, index - 1))} disabled={index === 0} className="p-2 disabled:opacity-30" aria-label={`Move slide ${index + 1} up`}><ArrowUp size={16} /></button><button type="button" onClick={() => setSection('heroSlides', move(draft.heroSlides, index, index + 1))} disabled={index === draft.heroSlides.length - 1} className="p-2 disabled:opacity-30" aria-label={`Move slide ${index + 1} down`}><ArrowDown size={16} /></button><button type="button" onClick={() => setSection('heroSlides', draft.heroSlides.filter(item => item.id !== slide.id))} className="p-2 hover:text-red-600" aria-label={`Remove slide ${index + 1}`}><Trash2 size={16} /></button></div>
            <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
              <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-2 items-start">
                <div><p className="label">Desktop crop</p><div className="relative aspect-[16/9] overflow-hidden" style={{ background: 'var(--bg-2)' }}>{slide.imageUrl && <Image src={slide.imageUrl} alt={product?.title || `Slide ${index + 1}`} fill sizes="(max-width: 768px) 80vw, 35vw" className="object-cover" />}</div></div>
                <div><p className="label">Mobile</p><div className="relative aspect-[3/4] overflow-hidden" style={{ background: 'var(--bg-2)' }}>{slide.imageUrl && <Image src={slide.imageUrl} alt="" fill sizes="84px" className="object-cover" />}</div></div>
              </div>
              <div className="space-y-4">
                {!product && <p className="text-sm text-red-600" role="alert">This product is no longer active. Choose another product or remove this slide before saving.</p>}
                <div><label className="label" htmlFor={`hero-product-${slide.id}`}>Linked product</label><select id={`hero-product-${slide.id}`} className="input" value={slide.productId} onChange={event => { const next = byId.get(event.target.value); if (next) changeSlide(slide.id, { productId: next.id, imageUrl: productImages(next)[0] || '' }) }}>{products.filter(item => productImages(item).length > 0).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
                <div><label className="label" htmlFor={`hero-image-${slide.id}`}>Product image</label><select id={`hero-image-${slide.id}`} className="input" value={slide.imageUrl} onChange={event => changeSlide(slide.id, { imageUrl: event.target.value })}>{uploaded && <option value={slide.imageUrl}>Uploaded banner image</option>}{images.map((url, imageIndex) => <option key={url} value={url}>Product image {imageIndex + 1}</option>)}</select></div>
                <div><label className="label" htmlFor={`hero-upload-${slide.id}`}>Or upload a banner image</label><input id={`hero-upload-${slide.id}`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="input" disabled={!layoutReady || !uploadReady || uploading === slide.id} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadImage(slide.id, file); event.currentTarget.value = '' }} /><p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}><ImagePlus size={13} className="inline mr-1" /> JPG, PNG, WebP, or AVIF under 4 MB.{!uploadReady && ' Uploads are unavailable in this local environment because Blob credentials are not configured.'}</p></div>
                {product && <Link href={`/products/${product.handle}`} target="_blank" className="text-xs underline" style={{ color: 'var(--gold)' }}>Preview linked product</Link>}
              </div>
            </div>
          </li>
        })}
      </ol>
      <div className="flex justify-end mt-5">{sectionButton('heroSlides', 'Save Hero Banner')}</div>
    </section>}
  </div>
}
