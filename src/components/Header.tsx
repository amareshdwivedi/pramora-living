'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Contact', href: '/contact' },
]

export function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [adminAuthed, setAdminAuthed] = useState(false)

  useEffect(() => {
    if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return
    fetch('/api/admin/auth').then(response => setAdminAuthed(response.ok)).catch(() => setAdminAuthed(false))
  }, [pathname])

  const logout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    setAdminAuthed(false)
    window.location.href = '/admin'
  }

  return (
    <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 md:h-24 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center" aria-label="Pramora Living — Home">
          <Image
            src="/Pramora-Logo.png"
            alt="Pramora"
            width={1254}
            height={1254}
            priority
            className="h-16 w-auto md:h-20"
          />
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
          {adminAuthed && (
            <button type="button" onClick={logout} className="hidden sm:inline-flex items-center gap-1.5 text-xs uppercase tracking-widest hover:text-gold-500" style={{ color: 'var(--text-2)' }}>
              <LogOut size={15} /> Logout
            </button>
          )}
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
