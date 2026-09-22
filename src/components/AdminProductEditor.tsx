'use client'

import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ImageIcon, RefreshCw, Trash2, X } from 'lucide-react'
import type { Product } from '@/lib/types'

const EMPTY: Omit<Product, 'id'> = {
  handle: '', title: '', description: '', aboutItem: [], type: 'Sculpture',
  tags: [], price: 0, compareAtPrice: 0, sku: '', image: '', images: [],
  status: 'active', amazonUrl: '',
}

function imageList(product: Partial<Product>): string[] {
  return product.images?.length ? product.images : product.image ? [product.image] : []
}

export default function AdminProductEditor() {
  const router = useRouter()
  const params = useParams<{ handle: string }>()
  const isNew = params.handle === 'new'
  const [form, setForm] = useState<Omit<Product, 'id'>>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imageUrlsInput, setImageUrlsInput] = useState('')
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null)
  const imageFilesRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/products/${params.handle}`)
      .then(async response => {
        if (!response.ok) throw new Error('Product not found.')
        setForm(await response.json())
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load product.'))
      .finally(() => setLoading(false))
  }, [isNew, params.handle])

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm(previous => ({ ...previous, [key]: value }))

  const toggleImage = (url: string) => setSelectedImageUrls(previous => previous.includes(url) ? previous.filter(item => item !== url) : [...previous, url])

  const reorderImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const ordered = [...imageList(form)]
    const [moved] = ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, moved)
    setForm(previous => ({ ...previous, image: ordered[0] ?? '', images: ordered }))
  }

  const uploadImageChanges = async (handle: string) => {
    const urls = imageUrlsInput.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
    if (selectedImageUrls.length === 0 && imageFiles.length === 0 && urls.length === 0) return
    const body = new FormData()
    body.append('remove', JSON.stringify(selectedImageUrls))
    body.append('urls', JSON.stringify(urls))
    imageFiles.forEach(file => body.append('files', file))
    const response = await fetch(`/api/admin/products/${handle}/images`, { method: 'POST', body })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Image update failed.')
  }

  const save = async () => {
    setSaving(true); setError(''); setMessage('')
    try {
      const payload = { ...form, images: form.images ?? [] }
      const response = await fetch(isNew ? '/api/products' : `/api/products/${params.handle}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save product.')
      await uploadImageChanges(data.handle)
      setMessage('Product and image changes saved.')
      setTimeout(() => router.push('/admin'), 500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save product.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><RefreshCw className="animate-spin" style={{ color: 'var(--gold)' }} /></div>
  if (error && !form.title && !isNew) return <div className="max-w-4xl mx-auto px-4 py-16"><p className="text-red-600">{error}</p></div>

  const images = imageList(form)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <button type="button" onClick={() => router.push('/admin')} className="inline-flex items-center gap-2 text-sm mb-8 hover:text-gold-500" style={{ color: 'var(--text-2)' }}><ArrowLeft size={16} /> Back to products</button>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div><p className="text-xs uppercase tracking-[0.3em] mb-2" style={{ color: 'var(--gold)' }}>{isNew ? 'New listing' : 'Product editor'}</p><h1 className="font-serif text-3xl font-medium" style={{ color: 'var(--text)' }}>{isNew ? 'Add product' : form.title}</h1></div>
        <button type="button" onClick={save} disabled={saving} className="btn-gold"><Check size={16} /> {saving ? 'Saving...' : 'Save product'}</button>
      </div>
      {message && <div className="mb-6 border-l-4 border-green-500 px-4 py-3 text-sm" style={{ backgroundColor: 'var(--bg-2)' }}>{message}</div>}
      {error && <div className="mb-6 border-l-4 border-red-500 px-4 py-3 text-sm text-red-600" style={{ backgroundColor: 'var(--bg-2)' }}>{error}</div>}

      <div className="card p-5 sm:p-8 space-y-8">
        <section>
          <h2 className="font-serif text-xl font-medium mb-5" style={{ color: 'var(--text)' }}>Product details</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div><label className="label">Title *</label><input className="input" value={form.title} onChange={e => setField('title', e.target.value)} /></div>
            <div><label className="label">Handle *</label><input className="input" value={form.handle} onChange={e => setField('handle', e.target.value.toLowerCase().replace(/\s+/g, '-'))} /></div>
            <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={e => setField('sku', e.target.value)} /></div>
            <div><label className="label">Type</label><input className="input" value={form.type} onChange={e => setField('type', e.target.value)} /></div>
            <div><label className="label">Price (₹) *</label><input className="input" type="number" value={form.price} onChange={e => setField('price', Number(e.target.value))} /></div>
            <div><label className="label">Compare-at price (₹)</label><input className="input" type="number" value={form.compareAtPrice} onChange={e => setField('compareAtPrice', Number(e.target.value))} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => setField('status', e.target.value as Product['status'])}><option value="active">Active</option><option value="draft">Draft</option></select></div>
            <div><label className="label">Amazon URL</label><input className="input" value={form.amazonUrl || ''} onChange={e => setField('amazonUrl', e.target.value)} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="label">Description (HTML)</label><textarea className="input resize-none" rows={5} value={form.description} onChange={e => setField('description', e.target.value)} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="label">About this item (one bullet per line)</label><textarea className="input resize-none" rows={6} value={form.aboutItem.join('\n')} onChange={e => setField('aboutItem', e.target.value.split('\n').map(item => item.trim()).filter(Boolean))} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="label">Tags (comma separated)</label><input className="input" value={form.tags.join(', ')} onChange={e => setField('tags', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))} /></div>
          </div>
        </section>

        <section className="border-t pt-8" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>Product images</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Drag images to reorder. The first image is the main storefront image. Select multiple images to remove, or add files and URLs in bulk.</p></div><ImageIcon size={22} style={{ color: 'var(--gold)' }} /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {images.map((url, index) => <label key={`${url}-${index}`} draggable onDragStart={() => setDraggedImageIndex(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedImageIndex !== null) reorderImage(draggedImageIndex, index); setDraggedImageIndex(null) }} onDragEnd={() => setDraggedImageIndex(null)} className={`relative aspect-square border cursor-grab overflow-hidden ${selectedImageUrls.includes(url) ? 'ring-2 ring-red-400' : ''} ${draggedImageIndex === index ? 'opacity-50' : ''}`} style={{ borderColor: selectedImageUrls.includes(url) ? '#ef4444' : 'var(--border)', backgroundColor: 'var(--bg-2)' }} title="Drag to reorder"><Image src={url} alt={`${form.title} image ${index + 1}`} fill className="object-contain p-2" /><span className="absolute top-2 left-2 rounded bg-white/90 p-1 shadow"><input type="checkbox" checked={selectedImageUrls.includes(url)} onChange={() => toggleImage(url)} onClick={event => event.stopPropagation()} aria-label={`Select image ${index + 1} for deletion`} /></span><span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1">{index === 0 ? 'Main' : index + 1}</span></label>)}
            {images.length === 0 && <div className="col-span-full border border-dashed p-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>No images yet.</div>}
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div><label className="label">Add image files</label><input ref={imageFilesRef} className="input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e => setImageFiles(Array.from(e.target.files ?? []))} />{imageFiles.length > 0 && <p className="text-xs mt-2" style={{ color: 'var(--text-2)' }}>{imageFiles.length} file(s) selected</p>}</div>
            <div><label className="label">Add image URLs (one per line)</label><textarea className="input resize-none" rows={3} value={imageUrlsInput} onChange={e => setImageUrlsInput(e.target.value)} placeholder="https://.../image.jpg" /></div>
          </div>
          {selectedImageUrls.length > 0 && <p className="flex items-center gap-2 mt-4 text-sm text-red-600"><Trash2 size={15} /> {selectedImageUrls.length} image(s) selected for deletion</p>}
        </section>
      </div>

      <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => router.push('/admin')} className="btn-outline"><X size={16} /> Cancel</button><button type="button" onClick={save} disabled={saving} className="btn-gold"><Check size={16} /> {saving ? 'Saving...' : 'Save product'}</button></div>
    </div>
  )
}
