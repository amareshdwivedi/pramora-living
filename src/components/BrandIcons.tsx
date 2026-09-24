import { FaAmazon, FaWhatsapp, FaInstagram, FaFacebook, FaTwitter } from 'react-icons/fa'
import { SiFlipkart } from 'react-icons/si'

export { FaAmazon, FaWhatsapp, FaInstagram, FaFacebook, FaTwitter, SiFlipkart }

export function MeeshoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#5F1E8F" />
      <path d="M5.5 16.5V9.6c0-1.6 1.1-2.7 2.5-2.7 1.5 0 2.4 1.1 2.4 2.7v6.9m0-6.9c0-1.6 1.1-2.7 2.5-2.7 1.5 0 2.4 1.1 2.4 2.7v6.9m0-6.9c0-1.6 1.1-2.7 2.5-2.7 1.5 0 2.4 1.1 2.4 2.7v6.9" stroke="#F8A33B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
