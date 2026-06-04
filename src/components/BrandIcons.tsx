import { FaAmazon, FaWhatsapp, FaInstagram, FaFacebook, FaTwitter } from 'react-icons/fa'
import { SiFlipkart } from 'react-icons/si'

export { FaAmazon, FaWhatsapp, FaInstagram, FaFacebook, FaTwitter, SiFlipkart }

// Meesho SVG (not in any icon library)
export function MeeshoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.5 14V8.5L7 14V8h1.5v5.5L12 8l3.5 5.5V8H17v8h-1.5L12 10.5 10.5 16H10.5z"/>
    </svg>
  )
}
