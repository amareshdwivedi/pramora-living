'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, X, Check, Lock, Eye, EyeOff, RefreshCw, ImageIcon, FileDown, LogOut } from 'lucide-react'
import type { Product } from '@/lib/types'

const EMPTY: Omit<Product, 'id'> = {
  handle: '', title: '', description: '', aboutItem: [], type: 'Sculpture',
  tags: [], price: 0, compareAtPrice: 0, sku: '', image: '',
  status: 'active', amazonUrl: '',
}

type FieldChange = { field: 'price' | 'inventory' | 'status' | 'title'; before: string | null; after: string | null }
type SyncChange = { amazonSku: string; asin: string | null; handle: string; title: string; kind: 'created' | 'updated' | 'unchanged'; fields: FieldChange[] }
type SyncReport = { runId: string; source: string; itemsCreated: number; itemsUpdated: number; itemsUnchanged: number; changes: SyncChange[]; imagesFetched?: number; imageFailures?: number }
type SyncProgressItem = { handle: string; title: string; amazonSku?: string; asin?: string | null; status: 'pending' | 'success' | 'error'; message?: string }

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [authErr, setAuthErr] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Omit<Product, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [fetchingImages, setFetchingImages] = useState(false)
  const [exportingImageUrls, setExportingImageUrls] = useState(false)
  const [syncingImageHandle, setSyncingImageHandle] = useState<string | null>(null)
  const [imageManagerProduct, setImageManagerProduct] = useState<Product | null>(null)
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imageUrlsInput, setImageUrlsInput] = useState('')
  const [savingImages, setSavingImages] = useState(false)
  const [cleaningImages, setCleaningImages] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [report, setReport] = useState<SyncReport | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgressItem[]>([])
  const [syncTotal, setSyncTotal] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageManifestFileRef = useRef<HTMLInputElement>(null)
  const imageFilesRef = useRef<HTMLInputElement>(null)

  const headers = { 'Content-Type': 'application/json' }

  const load = useCallback(async () => {
    const res = await fetch('/api/products')
    setProducts(await res.json())
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/admin/auth')
      .then(res => {
        if (!active) return
        if (res.ok) {
          setAuthed(true)
          void load()
        }
      })
      .finally(() => { if (active) setAuthChecking(false) })
    return () => { active = false }
  }, [load])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validate against an endpoint that actually checks the password, so a
    // successful login guarantees the same credential works for edits/sync.
    const res = await fetch('/api/admin/auth', { method: 'POST', headers: { 'x-admin-password': password } })
    if (res.ok) { setAuthed(true); setPassword(''); void load() }
    else setAuthErr('Incorrect password. Try again.')
  }

  const logout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    setAuthed(false)
    setPassword('')
    setProducts([])
    cancel()
  }

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const startEdit = (p: Product) => { setEditing(p); setForm({ ...p }); setCreating(false) }
  const startCreate = () => { setCreating(true); setEditing(null); setForm({ ...EMPTY }) }
  const cancel = () => { setEditing(null); setCreating(false) }

  const syncAmazon = async (file: File) => {
    setSyncing(true); setReport(null); setSyncProgress([]); setSyncTotal(0)
    try {
      const fd = new FormData()
      fd.append('file', file)
      // Note: no Content-Type header — the browser sets the multipart boundary.
      const res = await fetch('/api/admin/sync/amazon', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Sync failed.')
      }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      const apply = (event: { type: string; total?: number; handle?: string; title?: string; amazonSku?: string; asin?: string | null; stage?: string; status?: 'success' | 'error'; message?: string; report?: SyncReport }) => {
        if (event.type === 'start') setSyncTotal(event.total ?? 0)
        if (event.type === 'item' && event.handle && event.title) setSyncProgress(prev => {
          const item = prev.find(entry => entry.handle === event.handle) ?? { handle: event.handle!, title: event.title!, amazonSku: event.amazonSku, asin: event.asin, status: 'pending' as const }
          const next = { ...item, status: event.stage === 'record' ? 'pending' : (event.status ?? item.status), message: event.message }
          return prev.some(entry => entry.handle === event.handle) ? prev.map(entry => entry.handle === event.handle ? next : entry) : [...prev, next]
        })
        if (event.type === 'complete' && event.report) { setReport(event.report); load(); flash(`Sync complete: ${event.report.itemsCreated} new, ${event.report.itemsUpdated} updated, ${event.report.itemsUnchanged} unchanged. ${event.report.imagesFetched ?? 0} images fetched${event.report.imageFailures ? `, ${event.report.imageFailures} image issues` : ''}.`) }
        if (event.type === 'error') throw new Error(event.message || 'Sync failed.')
      }
      while (true) {
        const { value, done } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split('\n'); buffer = lines.pop() || ''
        lines.filter(Boolean).forEach(line => apply(JSON.parse(line)))
        if (done) break
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Sync failed — could not reach the server.')
    } finally {
      setSyncing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const fetchImages = async () => {
    setFetchingImages(true)
    try {
      const res = await fetch('/api/admin/sync/images', {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        await load()
        flash(data.message || `Cleared ${data.cleaned ?? 0} broken image placeholder(s).`)
      } else {
        flash(data.error || 'Image cleanup failed.')
      }
    } catch {
      flash('Image cleanup failed — could not reach the server.')
    } finally {
      setFetchingImages(false)
    }
  }

  const exportImageUrls = async (file: File) => {
    setExportingImageUrls(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/images/manifest', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Image URL export failed.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'amazon-image-urls.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      flash('Image URL CSV downloaded.')
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Image URL export failed.')
    } finally {
      setExportingImageUrls(false)
      if (imageManifestFileRef.current) imageManifestFileRef.current.value = ''
    }
  }

  const syncProductImages = async (handle: string) => {
    setSyncingImageHandle(handle)
    try {
      const res = await fetch('/api/admin/sync/images', {
        method: 'POST',
        headers,
        body: JSON.stringify({ handle }),
      })
      const data = await res.json()
      if (res.ok) {
        await load()
        flash(data.message || 'Product images updated.')
      } else {
        flash(data.error || 'Product image sync failed.')
      }
    } catch {
      flash('Product image sync failed — could not reach the server.')
    } finally {
      setSyncingImageHandle(null)
    }
  }

  const openImageManager = (product: Product) => {
    setImageManagerProduct(product)
    setSelectedImageUrls([])
    setImageFiles([])
    setImageUrlsInput('')
  }

  const closeImageManager = () => {
    setImageManagerProduct(null)
    setSelectedImageUrls([])
    setImageFiles([])
    setImageUrlsInput('')
    if (imageFilesRef.current) imageFilesRef.current.value = ''
  }

  const toggleImageSelection = (url: string) => {
    setSelectedImageUrls(previous => previous.includes(url) ? previous.filter(item => item !== url) : [...previous, url])
  }

  const saveImages = async () => {
    if (!imageManagerProduct) return
    setSavingImages(true)
    try {
      const formData = new FormData()
      formData.append('remove', JSON.stringify(selectedImageUrls))
      formData.append('urls', JSON.stringify(imageUrlsInput.split(/\r?\n/).map(value => value.trim()).filter(Boolean)))
      imageFiles.forEach(file => formData.append('files', file))
      const res = await fetch(`/api/admin/products/${imageManagerProduct.handle}/images`, { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Image update failed.')
      await load()
      flash(`Images updated: ${data.added ?? 0} added, ${data.removed ?? 0} removed.`)
      closeImageManager()
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Image update failed.')
    } finally {
      setSavingImages(false)
    }
  }

  const cleanAllImages = async () => {
    if (!window.confirm('Clean all stored product images? You can fetch them again from Amazon later.')) return
    setCleaningImages(true)
    try {
      const res = await fetch('/api/admin/sync/images', { method: 'DELETE', headers })
      const data = await res.json()
      if (res.ok) {
        await load()
        flash(data.message || 'All product images cleaned.')
      } else {
        flash(data.error || 'Image cleanup failed.')
      }
    } catch {
      flash('Image cleanup failed — could not reach the server.')
    } finally {
      setCleaningImages(false)
    }
  }

  const publishAll = async () => {
    setPublishing(true)
    try {
      const res = await fetch('/api/admin/products/publish', {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        await load()
        flash(data.message || `Published ${data.published ?? 0} product(s).`)
      } else {
        flash(data.error || 'Publish failed.')
      }
    } catch {
      flash('Publish failed — could not reach the server.')
    } finally {
      setPublishing(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      if (creating) {
        const res = await fetch('/api/products', { method: 'POST', headers, body: JSON.stringify(form) })
        if (res.ok) { flash('Product created!'); load(); cancel() }
        else flash('Error creating product.')
      } else if (editing) {
        const res = await fetch(`/api/products/${editing.handle}`, { method: 'PUT', headers, body: JSON.stringify(form) })
        if (res.ok) { flash('Product updated!'); load(); cancel() }
        else flash('Error updating product.')
      }
    } finally { setSaving(false) }
  }

  const del = async (handle: string) => {
    const res = await fetch(`/api/products/${handle}`, { method: 'DELETE', headers })
    if (res.ok) { flash('Product deleted.'); load(); setDeleteConfirm(null) }
    else flash('Error deleting product.')
  }

  const f = (key: keyof typeof form, val: string | number | string[]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  if (authChecking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Checking admin session">
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--gold)' }} />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <Lock size={32} className="mx-auto mb-4" style={{ color: 'var(--gold)' }} />
            <h1 className="font-serif text-2xl font-medium" style={{ color: 'var(--text)' }}>Admin Access</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>Enter your admin password to continue.</p>
          </div>
          <form onSubmit={login} className="space-y-4">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Admin password"
                value={password}
                onChange={e => { setPassword(e.target.value); setAuthErr('') }}
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-2)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {authErr && <p className="text-red-500 text-xs">{authErr}</p>}
            <button type="submit" className="btn-gold w-full justify-center">Login</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-serif text-3xl font-medium" style={{ color: 'var(--text)' }}>Product Manager</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{products.length} products</p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) syncAmazon(file) }}
          />
          <input
            ref={imageManifestFileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) exportImageUrls(file) }}
          />
          <button onClick={() => imageManifestFileRef.current?.click()} disabled={exportingImageUrls} className="btn-outline" title="Fetch Amazon image URLs into a CSV for Blob upload">
            <FileDown size={16} className={exportingImageUrls ? 'animate-pulse' : ''} />
            {exportingImageUrls ? 'Fetching URLs...' : 'Export Image URLs'}
          </button>
          <button onClick={fetchImages} disabled={fetchingImages} className="btn-outline">
            <ImageIcon size={16} className={fetchingImages ? 'animate-pulse' : ''} />
            {fetchingImages ? 'Updating...' : 'Update Images'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={syncing} className="btn-outline">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync from Amazon'}
          </button>
          <button onClick={startCreate} className="btn-gold">
            <Plus size={16} /> Add Product
          </button>
          <button onClick={logout} className="btn-outline" title="Log out of admin">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-6 px-4 py-3 text-sm font-medium border-l-4 border-gold-500" style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text)' }}>
          {msg}
        </div>
      )}

      {report && <div className="mb-6 text-sm" style={{ color: 'var(--text-2)' }}>Last sync: {report.itemsCreated} new, {report.itemsUpdated} updated, {report.imagesFetched ?? 0} images fetched.</div>}

      {syncing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl max-h-[85vh] overflow-hidden p-6" role="dialog" aria-modal="true" aria-label="Amazon sync progress">
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>Syncing from Amazon</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{syncProgress.filter(item => item.status !== 'pending').length} of {syncTotal || '…'} complete</p></div>
              <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--gold)' }} />
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {syncProgress.map(item => <div key={item.handle} className="flex items-center gap-3 border-b py-3" style={{ borderColor: 'var(--border)' }}><div className="shrink-0">{item.status === 'success' ? <Check size={18} className="text-green-600" /> : item.status === 'error' ? <X size={18} className="text-red-600" /> : <RefreshCw size={17} className="animate-spin" style={{ color: 'var(--gold)' }} />}</div><div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{item.title}</p><p className="text-xs truncate" style={{ color: item.status === 'error' ? '#dc2626' : 'var(--text-2)' }}>{item.message || item.amazonSku || item.handle}</p></div></div>)}
            </div>
          </div>
        </div>
      )}

      {/* Form (create/edit) */}
      {(creating || editing) && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={e => { if (e.target === e.currentTarget) cancel() }}>
        <div className="card my-auto w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain p-5 sm:max-h-[calc(100vh-4rem)] sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>
              {creating ? 'New Product' : `Edit: ${editing?.title}`}
            </h2>
            <button onClick={cancel} style={{ color: 'var(--text-2)' }}><X size={20} /></button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="label">Title *</label>
              <input className="input" value={form.title} onChange={e => f('title', e.target.value)} placeholder="Golden Ganesha" />
            </div>
            <div>
              <label className="label">Handle * (URL slug)</label>
              <input className="input" value={form.handle} onChange={e => f('handle', e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="golden-ganesha" />
            </div>
            <div>
              <label className="label">SKU</label>
              <input className="input" value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="PL-001" />
            </div>
            <div>
              <label className="label">Type</label>
              <input className="input" value={form.type} onChange={e => f('type', e.target.value)} placeholder="Sculpture" />
            </div>
            <div>
              <label className="label">Price (₹) *</label>
              <input className="input" type="number" value={form.price} onChange={e => f('price', parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="label">Compare At Price (₹)</label>
              <input className="input" type="number" value={form.compareAtPrice} onChange={e => f('compareAtPrice', parseFloat(e.target.value))} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Image URL or /images/products/filename.jpg</label>
              <input className="input" value={form.image} onChange={e => f('image', e.target.value)} placeholder="/images/products/golden-ganesha.jpeg" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Description (HTML)</label>
              <textarea className="input resize-none" rows={4} value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">About this item (one bullet per line)</label>
              <textarea className="input resize-none" rows={6} value={form.aboutItem.join('\n')} onChange={e => f('aboutItem', e.target.value.split('\n').map(item => item.trim()).filter(Boolean))} placeholder="Hand-finished resin sculpture\nSuitable for living rooms and office decor" />
            </div>
            <div>
              <label className="label">Tags (comma separated)</label>
              <input className="input" value={Array.isArray(form.tags) ? form.tags.join(', ') : ''} onChange={e => f('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} placeholder="sculpture, gold, luxury" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => f('status', e.target.value as 'active' | 'draft')}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div>
              <label className="label">Amazon URL</label>
              <input className="input" value={form.amazonUrl || ''} onChange={e => f('amazonUrl', e.target.value)} placeholder="https://amazon.in/..." />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-8 border-t pt-6 pb-1" style={{ borderColor: 'var(--border)' }}>
            <button onClick={save} disabled={saving} className="btn-gold">
              <Check size={16} /> {saving ? 'Saving...' : 'Save Product'}
            </button>
            <button onClick={cancel} className="btn-outline">Cancel</button>
          </div>
        </div>
        </div>
      )}

      {imageManagerProduct && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={e => { if (e.target === e.currentTarget) closeImageManager() }}>
          <div className="card my-auto w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto p-5 sm:p-8" role="dialog" aria-modal="true" aria-label={`Manage images for ${imageManagerProduct.title}`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>Manage images</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{imageManagerProduct.title}</p>
              </div>
              <button onClick={closeImageManager} style={{ color: 'var(--text-2)' }} aria-label="Close image manager"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {(imageManagerProduct.images?.length ? imageManagerProduct.images : imageManagerProduct.image ? [imageManagerProduct.image] : []).map((url, index) => (
                <label key={`${url}-${index}`} className={`relative aspect-square border cursor-pointer overflow-hidden ${selectedImageUrls.includes(url) ? 'border-red-500 ring-2 ring-red-300' : ''}`} style={{ borderColor: selectedImageUrls.includes(url) ? '#ef4444' : 'var(--border)', backgroundColor: 'var(--bg-2)' }}>
                  <Image src={url} alt={`${imageManagerProduct.title} image ${index + 1}`} fill className="object-contain p-2" />
                  <span className="absolute top-2 left-2 rounded bg-white/90 p-1 shadow">
                    <input type="checkbox" checked={selectedImageUrls.includes(url)} onChange={() => toggleImageSelection(url)} aria-label={`Select image ${index + 1} for deletion`} />
                  </span>
                  <span className="absolute bottom-1 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5">{index + 1}</span>
                </label>
              ))}
            </div>

            <div className="space-y-5 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
              <div>
                <label className="label">Add image files (you can select multiple)</label>
                <input ref={imageFilesRef} className="input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e => setImageFiles(Array.from(e.target.files ?? []))} />
                {imageFiles.length > 0 && <p className="text-xs mt-2" style={{ color: 'var(--text-2)' }}>{imageFiles.length} file(s) selected</p>}
              </div>
              <div>
                <label className="label">Add image URLs (one per line)</label>
                <textarea className="input resize-none" rows={3} value={imageUrlsInput} onChange={e => setImageUrlsInput(e.target.value)} placeholder="https://.../product-image.jpg" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-7 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>{selectedImageUrls.length ? `${selectedImageUrls.length} image(s) selected for deletion` : 'Select images to remove them from the database and Blob.'}</p>
              <div className="flex gap-3">
                <button onClick={closeImageManager} className="btn-outline">Cancel</button>
                <button onClick={saveImages} disabled={savingImages} className="btn-gold"><Check size={16} /> {savingImages ? 'Saving...' : 'Save image changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-widest" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
              <th className="py-3 pr-4 font-medium w-16">Image</th>
              <th className="py-3 pr-4 font-medium">Product</th>
              <th className="py-3 pr-4 font-medium">Price</th>
              <th className="py-3 pr-4 font-medium">SKU</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {products.map(p => (
              <tr key={p.handle} className="hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--border)' }}>
                <td className="py-3 pr-4">
                  <div className="relative w-12 h-12 overflow-hidden" style={{ backgroundColor: 'var(--bg-2)' }}>
                    {p.image && <Image src={p.image} alt={p.title} fill className="object-contain p-1" />}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <p className="font-medium font-serif" style={{ color: 'var(--text)' }}>{p.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{p.handle}</p>
                </td>
                <td className="py-3 pr-4" style={{ color: 'var(--text)' }}>
                  ₹{p.price.toLocaleString('en-IN')}
                  {p.compareAtPrice > p.price && (
                    <span className="line-through text-xs ml-2" style={{ color: 'var(--text-2)' }}>
                      ₹{p.compareAtPrice.toLocaleString('en-IN')}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 font-mono text-xs" style={{ color: 'var(--text-2)' }}>{p.sku}</td>
                <td className="py-3 pr-4">
                  <span className={`text-xs px-2 py-0.5 font-medium ${p.status === 'active' ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30' : 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => startEdit(p)} className="p-1.5 hover:text-gold-500 transition-colors" style={{ color: 'var(--text-2)' }}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => openImageManager(p)} className="p-1.5 hover:text-gold-500 transition-colors" style={{ color: 'var(--text-2)' }} aria-label={`Manage images for ${p.title}`} title="Add or delete images">
                      <ImageIcon size={15} />
                    </button>
                    <button
                      onClick={() => syncProductImages(p.handle)}
                      disabled={syncingImageHandle === p.handle}
                      className="p-1.5 hover:text-gold-500 transition-colors disabled:opacity-50"
                      style={{ color: 'var(--text-2)' }}
                      aria-label={`Sync Amazon images for ${p.title}`}
                      title="Sync Amazon images"
                    >
                      <RefreshCw size={15} className={syncingImageHandle === p.handle ? 'animate-spin' : ''} />
                    </button>
                    {deleteConfirm === p.handle ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => del(p.handle)} className="text-xs px-2 py-1 bg-red-500 text-white hover:bg-red-600">Confirm</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-1 border" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(p.handle)} className="p-1.5 hover:text-red-500 transition-colors" style={{ color: 'var(--text-2)' }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>Publish Changes</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            Make all draft products visible across the storefront after sync and image updates are ready.
          </p>
        </div>
        <button
          onClick={publishAll}
          disabled={publishing || products.every(p => p.status === 'active')}
          className="btn-gold justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={16} />
          {publishing ? 'Publishing...' : 'Publish All Changes'}
        </button>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={cleanAllImages}
          disabled={cleaningImages || fetchingImages || syncingImageHandle !== null}
          className="btn-outline !border-red-400 !text-red-600 hover:!bg-red-500 hover:!text-white disabled:opacity-50"
        >
          <Trash2 size={16} />
          {cleaningImages ? 'Cleaning Images...' : 'Clean All Images'}
        </button>
      </div>
    </div>
  )
}
