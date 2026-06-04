import Link from 'next/link'
import { Instagram, Facebook, Twitter, MessageCircle } from 'lucide-react'

const SOCIAL = [
  { label: 'Instagram', href: 'https://instagram.com/pramoraliving', icon: Instagram },
  { label: 'Facebook',  href: 'https://facebook.com/pramoraliving',  icon: Facebook },
  { label: 'Twitter',   href: 'https://twitter.com/pramoraliving',   icon: Twitter },
  { label: 'WhatsApp',  href: 'https://wa.me/919880009575',          icon: MessageCircle },
]

const SHOP = [
  { label: 'Amazon',        href: 'https://amazon.in',      color: '#FF9900' },
  { label: 'Flipkart',      href: 'https://flipkart.com',   color: '#2874F0' },
  { label: 'Meesho',        href: 'https://meesho.com',     color: '#9B2D8E' },
  { label: 'WhatsApp Store',href: 'https://wa.me/919880009575?text=Hi%2C%20I%20want%20to%20order%20from%20Pramora%20Living', color: '#25D366' },
]

export function Footer() {
  return (
    <footer className="border-t mt-28" style={{ borderColor: 'var(--border)' }}>
      {/* Top section */}
      <div className="container-craft py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="font-serif text-xl" style={{ color: 'var(--text)' }}>
            Pramora Living
          </Link>
          <p className="body-text mt-4 text-xs leading-relaxed">
            Curated artisan sculptures and home décor that bring culture, meaning, and beauty to everyday living spaces.
          </p>
          {/* Social */}
          <div className="flex gap-4 mt-6">
            {SOCIAL.map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                aria-label={s.label}
                className="transition-opacity hover:opacity-50"
                style={{ color: 'var(--text-2)' }}
              >
                <s.icon size={16} strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div>
          <p className="overline mb-5">Navigate</p>
          <ul className="space-y-3">
            {[
              { label: 'Home', href: '/' },
              { label: 'Products', href: '/products' },
              { label: 'Contact', href: '/contact' },
            ].map(l => (
              <li key={l.href}>
                <Link href={l.href}
                  className="text-sm font-light transition-opacity hover:opacity-50"
                  style={{ color: 'var(--text-2)' }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Buy Online */}
        <div>
          <p className="overline mb-5">Buy Online</p>
          <ul className="space-y-3">
            {SHOP.map(l => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-light flex items-center gap-2 transition-opacity hover:opacity-60"
                  style={{ color: 'var(--text-2)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="overline mb-5">Contact</p>
          <ul className="space-y-3 text-sm font-light" style={{ color: 'var(--text-2)' }}>
            <li>Bengaluru, Karnataka — 560087</li>
            <li>
              <a href="tel:+919880009575" className="hover:opacity-60 transition-opacity">+91 98800 09575</a>
            </li>
            <li>
              <a href="mailto:hello@pramoraliving.com" className="hover:opacity-60 transition-opacity">hello@pramoraliving.com</a>
            </li>
            <li>
              <a href="https://wa.me/919880009575" target="_blank" rel="noopener noreferrer"
                className="hover:opacity-60 transition-opacity">WhatsApp Us</a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t py-5 container-craft flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <p className="text-2xs uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
          © {new Date().getFullYear()} Pramora Living
        </p>
        <p className="text-2xs uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
          Crafted with care in India
        </p>
      </div>
    </footer>
  )
}
