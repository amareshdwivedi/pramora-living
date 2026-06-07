'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, X, Check, Lock, Eye, EyeOff, RefreshCw } from 'lucide-react'
import type { Product } from '@/lib/types'

const EMPTY: Omit<Product, 'id'> = {
  handle: '', title: '', description: '', type: 'Sculpture',
  tags: [], price: 0, compareAtPrice: 0, sku: '', image: '',
  status: 'active', amazonUrl: '', flipkartUrl: '', meeshoUrl: '',
}

type FieldChange = { field: 'price' | 'inventory' | 'status' | 'title'; before: string | null; after: string | null }
type SyncChange = { amazonSku: string; asin: string | null; handle: string; title: string; kind: 'created' | 'updated' | 'unchanged'; fields: FieldChange[] }
type SyncReport = { runId: string; source: string; itemsCreated: number; itemsUpdated: number; itemsUnchanged: number; changes: SyncChange[] }

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Omit<Product, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [report, setReport] = useState<SyncReport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password }

  const load = useCallback(async () => {
    const res = await fetch('/api/products')
    setProducts(await res.json())
  }, [])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/products', { headers: { 'x-admin-password': password } })
    if (res.ok) { setAuthed(true); load() }
    else setAuthErr('Incorrect password. Try again.')
  }

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const startEdit = (p: Product) => { setEditing(p); setForm({ ...p }); setCreating(false) }
  const startCreate = () => { setCreating(true); setEditing(null); setForm({ ...EMPTY }) }
  const cancel = () => { setEditing(null); setCreating(false) }

  const syncAmazon = async (file: File) => {
    setSyncing(true); setReport(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      // Note: no Content-Type header — the browser sets the multipart boundary.
      const res = await fetch('/api/admin/sync/amazon', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: fd,
      })
      const data = await res.json()
      if (res.ok) {
        setReport(data)
        await load()
        flash(`Sync complete: ${data.itemsCreated} new, ${data.itemsUpdated} updated, ${data.itemsUnchanged} unchanged.`)
      } else {
        flash(data.error || 'Sync failed.')
      }
    } catch {
      flash('Sync failed — could not reach the server.')
    } finally {
      setSyncing(false)
      if (fileRef.current) fileRef.current.value = ''
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
        <div className="flex gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) syncAmazon(file) }}
          />
          <button onClick={() => fileRef.current?.click()} disabled={syncing} className="btn-outline">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync from Amazon'}
          </button>
          <button onClick={startCreate} className="btn-gold">
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-6 px-4 py-3 text-sm font-medium border-l-4 border-gold-500" style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text)' }}>
          {msg}
        </div>
      )}

      {/* Amazon sync report */}
      {report && (
        <div className="card p-6 mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>Amazon Sync Results</h2>
            <button onClick={() => setReport(null)} style={{ color: 'var(--text-2)' }}><X size={20} /></button>
          </div>

          <div className="flex flex-wrap gap-3 mb-6 text-sm">
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">🆕 {report.itemsCreated} new</span>
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">✏️ {report.itemsUpdated} updated</span>
            <span className="px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text-2)' }}>✅ {report.itemsUnchanged} unchanged</span>
          </div>

          {report.itemsCreated + report.itemsUpdated === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>Everything is already in sync with Amazon. Nothing changed.</p>
          ) : (
            <div className="space-y-3">
              {report.changes.filter(c => c.kind !== 'unchanged').map(c => (
                <div key={c.amazonSku} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="min-w-0 sm:flex-1">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{c.title}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-2)' }}>{c.amazonSku}{c.asin ? ` · ${c.asin}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {c.kind === 'created' ? (
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">🆕 Created as draft</span>
                    ) : (
                      c.fields.map(f => (
                        <span key={f.field} className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text)' }}>
                          {f.field === 'price' && <>💰 ₹{f.before ?? '—'} → <strong>₹{f.after ?? '—'}</strong></>}
                          {f.field === 'inventory' && <>📦 {f.before ?? '—'} → <strong>{f.after ?? '—'}</strong></>}
                          {f.field === 'status' && <>🔴 {f.before ?? '—'} → <strong>{f.after ?? '—'}</strong></>}
                          {f.field === 'title' && <>✏️ Amazon title updated</>}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form (create/edit) */}
      {(creating || editing) && (
        <div className="card p-6 mb-10">
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
            <div>
              <label className="label">Flipkart URL</label>
              <input className="input" value={form.flipkartUrl || ''} onChange={e => f('flipkartUrl', e.target.value)} placeholder="https://flipkart.com/..." />
            </div>
            <div>
              <label className="label">Meesho URL</label>
              <input className="input" value={form.meeshoUrl || ''} onChange={e => f('meeshoUrl', e.target.value)} placeholder="https://meesho.com/..." />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={save} disabled={saving} className="btn-gold">
              <Check size={16} /> {saving ? 'Saving...' : 'Save Product'}
            </button>
            <button onClick={cancel} className="btn-outline">Cancel</button>
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
                    {p.image && <Image src={p.image} alt={p.title} fill className="object-cover" />}
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
    </div>
  )
}
