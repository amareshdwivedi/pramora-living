'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Check, Eye, EyeOff, Lock, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import type { Product } from '@/lib/types'

type FieldChange = { field: 'price' | 'inventory' | 'status' | 'title'; before: string | null; after: string | null }
type SyncChange = { amazonSku: string; asin: string | null; handle: string; title: string; kind: 'created' | 'updated' | 'unchanged'; fields: FieldChange[] }
type SyncReport = { runId: string; source: string; itemsCreated: number; itemsUpdated: number; itemsUnchanged: number; changes: SyncChange[]; imagesFetched?: number; imageFailures?: number }
type SyncProgressItem = { handle: string; title: string; amazonSku?: string; asin?: string | null; status: 'pending' | 'success' | 'error'; message?: string }

export default function AdminPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [authErr, setAuthErr] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [report, setReport] = useState<SyncReport | null>(null)
  const [msg, setMsg] = useState('')
  const [syncProgress, setSyncProgress] = useState<SyncProgressItem[]>([])
  const [syncTotal, setSyncTotal] = useState(0)
  const [selectedHandles, setSelectedHandles] = useState<string[]>([])
  const [publishing, setPublishing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/products')
    if (response.ok) setProducts(await response.json())
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/admin/auth').then(response => {
      if (!active) return
      if (response.ok) { setAuthed(true); void load() }
    }).finally(() => { if (active) setAuthChecking(false) })
    return () => { active = false }
  }, [load])

  const flash = (message: string) => { setMsg(message); setTimeout(() => setMsg(''), 3500) }

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    const response = await fetch('/api/admin/auth', { method: 'POST', headers: { 'x-admin-password': password } })
    if (response.ok) { setAuthed(true); setPassword(''); void load() } else setAuthErr('Incorrect password. Try again.')
  }

  const syncAmazon = async (file: File) => {
    setSyncing(true); setReport(null); setSyncProgress([]); setSyncTotal(0)
    try {
      const body = new FormData(); body.append('file', file)
      const response = await fetch('/api/admin/sync/amazon', { method: 'POST', body })
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({}))).error || 'Sync failed.')
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      const apply = (event: { type: string; total?: number; handle?: string; title?: string; amazonSku?: string; asin?: string | null; stage?: string; status?: 'success' | 'error'; message?: string; report?: SyncReport }) => {
        if (event.type === 'start') setSyncTotal(event.total ?? 0)
        if (event.type === 'item' && event.handle && event.title) setSyncProgress(previous => {
          const existing = previous.find(item => item.handle === event.handle)
          const next = { handle: event.handle!, title: event.title!, amazonSku: event.amazonSku, asin: event.asin, status: event.stage === 'record' ? 'pending' as const : (event.status ?? existing?.status ?? 'pending'), message: event.message }
          return existing ? previous.map(item => item.handle === event.handle ? { ...item, ...next } : item) : [...previous, next]
        })
        if (event.type === 'complete' && event.report) { setReport(event.report); void load(); flash(`Sync complete: ${event.report.itemsCreated} new, ${event.report.itemsUpdated} updated, ${event.report.imagesFetched ?? 0} images fetched.`) }
        if (event.type === 'error') throw new Error(event.message || 'Sync failed.')
      }
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split('\n'); buffer = lines.pop() || ''
        lines.filter(Boolean).forEach(line => apply(JSON.parse(line)))
        if (done) break
      }
    } catch (error) { flash(error instanceof Error ? error.message : 'Sync failed.') }
    finally { setSyncing(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const deleteProduct = async (handle: string) => {
    try {
      const response = await fetch(`/api/products/${handle}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Product deletion failed.')
      await load(); setSelectedHandles(previous => previous.filter(item => item !== handle)); setDeleteConfirm(null); flash('Product and its images deleted.')
    } catch (error) { flash(error instanceof Error ? error.message : 'Product deletion failed.') }
  }

  const toggleSelected = (handle: string) => {
    setSelectedHandles(previous => previous.includes(handle) ? previous.filter(item => item !== handle) : [...previous, handle])
  }

  const toggleAll = () => {
    setSelectedHandles(previous => previous.length === products.length ? [] : products.map(product => product.handle))
  }

  const publishSelected = async () => {
    if (selectedHandles.length === 0) return
    setPublishing(true)
    try {
      const response = await fetch('/api/admin/products/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handles: selectedHandles }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Publishing failed.')
      await load(); setSelectedHandles([]); flash(data.message || 'Selected products published.')
    } catch (error) { flash(error instanceof Error ? error.message : 'Publishing failed.') }
    finally { setPublishing(false) }
  }

  if (authChecking) return <div className="min-h-[60vh] flex items-center justify-center" role="status"><RefreshCw size={24} className="animate-spin" style={{ color: 'var(--gold)' }} /></div>

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-sm">
        <div className="text-center mb-8"><Lock size={32} className="mx-auto mb-4" style={{ color: 'var(--gold)' }} /><h1 className="font-serif text-2xl font-medium" style={{ color: 'var(--text)' }}>Admin Access</h1><p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>Enter your admin password to continue.</p></div>
        <form onSubmit={login} className="space-y-4"><div className="relative"><input type={showPw ? 'text' : 'password'} className="input pr-10" placeholder="Admin password" value={password} onChange={event => { setPassword(event.target.value); setAuthErr('') }} required /><button type="button" onClick={() => setShowPw(previous => !previous)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-2)' }}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{authErr && <p className="text-red-500 text-xs">{authErr}</p>}<button type="submit" className="btn-gold w-full justify-center">Login</button></form>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between gap-4 mb-10"><div><h1 className="font-serif text-3xl font-medium" style={{ color: 'var(--text)' }}>Product Manager</h1><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{products.length} products</p></div><div className="flex flex-wrap justify-end gap-3"><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void syncAmazon(file) }} /><button onClick={() => fileRef.current?.click()} disabled={syncing} className="btn-outline"><RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync from Amazon'}</button><button onClick={() => router.push('/admin/products/new')} className="btn-gold"><Plus size={16} /> Add product</button></div></div>
      {msg && <div className="mb-6 px-4 py-3 text-sm font-medium border-l-4 border-gold-500" style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text)' }}>{msg}</div>}
      {report && <div className="mb-6 text-sm" style={{ color: 'var(--text-2)' }}>Last sync: {report.itemsCreated} new, {report.itemsUpdated} updated, {report.imagesFetched ?? 0} images fetched.</div>}

      {syncing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="card w-full max-w-2xl max-h-[85vh] overflow-hidden p-6" role="dialog" aria-modal="true"><div className="flex items-center justify-between mb-5"><div><h2 className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>Syncing from Amazon</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{syncProgress.filter(item => item.status !== 'pending').length} of {syncTotal || '…'} complete</p></div><RefreshCw size={20} className="animate-spin" style={{ color: 'var(--gold)' }} /></div><div className="space-y-2 max-h-[60vh] overflow-y-auto">{syncProgress.map(item => <div key={item.handle} className="flex items-center gap-3 border-b py-3" style={{ borderColor: 'var(--border)' }}><div>{item.status === 'success' ? <Check size={18} className="text-green-600" /> : item.status === 'error' ? <X size={18} className="text-red-600" /> : <RefreshCw size={17} className="animate-spin" style={{ color: 'var(--gold)' }} />}</div><div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{item.title}</p><p className="text-xs truncate" style={{ color: item.status === 'error' ? '#dc2626' : 'var(--text-2)' }}>{item.message || item.amazonSku || item.handle}</p></div></div>)}</div></div></div>}

      <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr className="border-b text-left text-xs uppercase tracking-widest" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}><th className="py-3 pr-4 font-medium w-10"><input type="checkbox" checked={products.length > 0 && selectedHandles.length === products.length} onChange={toggleAll} aria-label="Select all products" /></th><th className="py-3 pr-4 font-medium w-16">Image</th><th className="py-3 pr-4 font-medium">Product</th><th className="py-3 pr-4 font-medium">Price</th><th className="py-3 pr-4 font-medium">SKU</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium text-right">Actions</th></tr></thead><tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>{products.map(product => <tr key={product.handle} className="hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--border)' }}><td className="py-3 pr-4"><input type="checkbox" checked={selectedHandles.includes(product.handle)} onChange={() => toggleSelected(product.handle)} aria-label={`Select ${product.title} for publishing`} /></td><td className="py-3 pr-4"><div className="relative w-12 h-12 overflow-hidden" style={{ backgroundColor: 'var(--bg-2)' }}>{product.image && <Image src={product.image} alt={product.title} fill className="object-contain p-1" />}</div></td><td className="py-3 pr-4"><p className="font-medium" style={{ color: 'var(--text)' }}>{product.title}</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{product.handle} · {product.images?.length ?? (product.image ? 1 : 0)} image(s)</p></td><td className="py-3 pr-4" style={{ color: 'var(--text)' }}>₹{product.price.toLocaleString('en-IN')}</td><td className="py-3 pr-4 font-mono text-xs" style={{ color: 'var(--text-2)' }}>{product.sku}</td><td className="py-3 pr-4"><span className={`text-xs px-2 py-0.5 font-medium ${product.status === 'active' ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30' : 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30'}`}>{product.status}</span></td><td className="py-3"><div className="flex items-center justify-end gap-2"><button onClick={() => router.push(`/admin/products/${product.handle}`)} className="p-1.5 hover:text-gold-500" style={{ color: 'var(--text-2)' }} aria-label={`Edit ${product.title}`} title="Edit product"><Pencil size={15} /></button>{deleteConfirm === product.handle ? <div className="flex items-center gap-1"><button onClick={() => void deleteProduct(product.handle)} className="text-xs px-2 py-1 bg-red-500 text-white hover:bg-red-600">Confirm</button><button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-1 border" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>Cancel</button></div> : <button onClick={() => setDeleteConfirm(product.handle)} className="p-1.5 hover:text-red-500" style={{ color: 'var(--text-2)' }} aria-label={`Delete ${product.title}`} title="Delete product"><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table></div>
      <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t pt-6" style={{ borderColor: 'var(--border)' }}><div><h2 className="font-serif text-xl font-medium" style={{ color: 'var(--text)' }}>Publish products</h2><p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{selectedHandles.length > 0 ? `${selectedHandles.length} selected` : 'Select products above, or use the header checkbox to select all.'}</p></div><button onClick={() => void publishSelected()} disabled={publishing || selectedHandles.length === 0} className="btn-gold justify-center disabled:opacity-50 disabled:cursor-not-allowed"><Check size={16} /> {publishing ? 'Publishing...' : `Publish selected${selectedHandles.length ? ` (${selectedHandles.length})` : ''}`}</button></div>
    </div>
  )
}
