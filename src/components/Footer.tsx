import Link from 'next/link'
import Image from 'next/image'
import { FaAmazon, FaWhatsapp, FaInstagram, FaFacebook, FaTwitter, SiFlipkart, MeeshoIcon } from './BrandIcons'
import { whatsappUrl, WHATSAPP_NUMBER, PHONE_DISPLAY, CONTACT_EMAIL } from '@/lib/contact'

const SOCIAL = [
  { label: 'Instagram', href: 'https://instagram.com/pramoraliving', Icon: FaInstagram },
  { label: 'Facebook',  href: 'https://www.facebook.com/profile.php?id=61590663961091', Icon: FaFacebook },
  { label: 'Twitter',   href: 'https://twitter.com/pramoraliving',   Icon: FaTwitter },
  { label: 'WhatsApp',  href: `https://wa.me/${WHATSAPP_NUMBER}`,     Icon: FaWhatsapp },
]

const SHOP = [
  { label: 'Amazon',         href: 'https://amazon.in',      color: '#FF9900', Icon: FaAmazon },
  { label: 'Flipkart',       href: 'https://www.flipkart.com', color: '#2874F0', Icon: SiFlipkart },
  { label: 'Meesho',         href: 'https://www.meesho.com',   color: '#5F1E8F', Icon: MeeshoIcon },
  { label: 'WhatsApp Store', href: whatsappUrl('Hi Pramora Living, I need help with your products.'), color: '#25D366', Icon: FaWhatsapp },
]

export function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

        {/* Brand */}
        <div className="lg:col-span-2">
          <Link href="/" className="inline-flex items-center mb-3" aria-label="Pramora Living — Home">
            <Image
              src="/Pramora-Logo.png"
              alt="Pramora"
              width={1254}
              height={1254}
              className="h-24 w-auto object-contain"
            />
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--gold)' }}>Artisan-Made Pieces</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Artisan-crafted pieces made with natural character, thoughtful design, and a commitment to more conscious living.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text)' }}>Quick Links</h4>
          <ul className="space-y-3">
            {[
              { label: 'Home', href: '/' },
              { label: 'Products', href: '/products' },
              { label: 'Contact Us', href: '/contact' },
            ].map(l => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm hover:text-gold-500 transition-colors" style={{ color: 'var(--text-2)' }}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Buy Online */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text)' }}>Buy Online</h4>
          <ul className="space-y-3">
            {SHOP.map(l => (
              <li key={l.label}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center gap-2.5 hover:opacity-80 transition-opacity font-medium"
                  style={{ color: l.color }}
                >
                  <l.Icon size={15} />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Social + Contact */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text)' }}>Follow Us</h4>
          <div className="flex gap-3 mb-6">
            {SOCIAL.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="w-9 h-9 flex items-center justify-center border rounded-full transition-all hover:border-gold-500 hover:text-gold-500"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                <s.Icon size={15} />
              </a>
            ))}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
            📍 Bengaluru, Karnataka, India<br />
            📞 {PHONE_DISPLAY}<br />
            ✉ {CONTACT_EMAIL}
          </p>
        </div>
      </div>

      <div className="border-t py-5 px-4 text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
        © {new Date().getFullYear()} Pramora Living. All rights reserved. Crafted with care in India.
      </div>
    </footer>
  )
}
