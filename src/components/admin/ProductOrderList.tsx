'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'
import type { Product } from '@/lib/types'

function move<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items
  const copy = [...items]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

export function ProductOrderList({ ids, products, onChange, onRemove, minLength = 0 }: { ids: string[]; products: Product[]; onChange: (ids: string[]) => void; onRemove?: (id: string) => void; minLength?: number }) {
  const byId = new Map(products.map(product => [product.id, product]))
  const [dragged, setDragged] = useState<string | null>(null)

  return <ol className="space-y-2">
    {ids.map((id, index) => {
      const product = byId.get(id)
      if (!product) return null
      return <li key={id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged) onChange(move(ids, ids.indexOf(dragged), index)); setDragged(null) }} className={`card flex items-center gap-3 p-2 sm:p-3 ${dragged === id ? 'opacity-50' : ''}`}>
        <span draggable onDragStart={event => { setDragged(id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id) }} onDragEnd={() => setDragged(null)} className="shrink-0 cursor-grab" title="Drag to reorder"><GripVertical size={18} style={{ color: 'var(--text-2)' }} aria-hidden="true" /></span>
        <span className="w-7 shrink-0 text-center text-xs" style={{ color: 'var(--text-2)' }}>{index + 1}</span>
        <div className="relative h-12 w-12 shrink-0" style={{ background: 'var(--bg-2)' }}>{product.image && <Image src={product.image} alt="" fill className="object-contain p-1" sizes="48px" />}</div>
        <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--text)' }}>{product.title}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onChange(move(ids, index, index - 1))} disabled={index === 0} className="p-2 disabled:opacity-30" aria-label={`Move ${product.title} up`}><ArrowUp size={16} /></button>
          <button type="button" onClick={() => onChange(move(ids, index, index + 1))} disabled={index === ids.length - 1} className="p-2 disabled:opacity-30" aria-label={`Move ${product.title} down`}><ArrowDown size={16} /></button>
          {onRemove && <button type="button" onClick={() => onRemove(id)} disabled={ids.length <= minLength} className="p-2 hover:text-red-600 disabled:opacity-30" aria-label={`Remove ${product.title}`}><Trash2 size={16} /></button>}
        </div>
      </li>
    })}
  </ol>
}
