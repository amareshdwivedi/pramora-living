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
    <header
      className="sticky top-0 z-50 border-b"
      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      {/* Announcement bar */}
      <div
        className="text-center py-2 text-2xs tracking-widest uppercase font-sans"
        style={{ backgroundColor: 'var(--text)', color: 'var(--bg)' }}
      >
        Free shipping on orders above ₹2,000 &nbsp;·&nbsp; Pan-India Delivery
      </div>

      <div className="container-craft">
        {/* Main header row */}
        <div className="flex items-center justify-between py-5 gap-6">
          {/* Left: mobile menu */}
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center"
            style={{ color: 'var(--text)' }}
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Center: brand */}
          <Link href="/" className="flex flex-col items-center leading-none mx-auto md:mx-0">
            <span
              className="font-serif text-2xl md:text-3xl tracking-wide"
              style={{ color: 'var(--text)' }}
            >
              Pramora Living
            </span>
            <span
              className="text-2xs uppercase tracking-widest mt-0.5 font-sans"
              style={{ color: 'var(--text-3)' }}
            >
              Artisan Home Décor
            </span>
          </Link>

          {/* Right: theme toggle */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>

        {/* Desktop nav — centered below brand */}
        <nav className="hidden md:flex items-center justify-center gap-10 pb-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="text-2xs uppercase tracking-widest font-sans font-medium transition-colors duration-200 pb-0.5"
              style={{
                color: pathname === n.href ? 'var(--text)' : 'var(--text-2)',
                borderBottom: pathname === n.href ? '1px solid var(--text)' : '1px solid transparent',
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden border-t py-6 px-5 space-y-5"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="block text-2xs uppercase tracking-widest font-medium py-1"
              style={{ color: pathname === n.href ? 'var(--text)' : 'var(--text-2)' }}
            >
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
