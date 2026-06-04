'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Contact', href: '/contact' },
]

export function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-serif text-xl md:text-2xl font-semibold tracking-wide" style={{ color: 'var(--text)' }}>
            Pramora Living
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--gold)' }}>
            Artisan Home Décor
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`text-sm uppercase tracking-widest transition-colors duration-200 hover:text-gold-500 ${
                pathname === n.href ? 'text-gold-500 font-medium' : ''
              }`}
              style={{ color: pathname === n.href ? 'var(--gold)' : 'var(--text-2)' }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {/* Mobile menu toggle */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center"
            style={{ color: 'var(--text)' }}
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t py-4 px-4 space-y-3" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="block text-sm uppercase tracking-widest py-2 transition-colors hover:text-gold-500"
              style={{ color: pathname === n.href ? 'var(--gold)' : 'var(--text-2)' }}
            >
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
