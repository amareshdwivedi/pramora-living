import { FaAmazon, FaWhatsapp, FaInstagram, FaFacebook, FaTwitter } from 'react-icons/fa'

export { FaAmazon, FaWhatsapp, FaInstagram, FaFacebook, FaTwitter }

// "Available at Amazon" badge — official-style brand asset for linking to a listing.
export function AmazonBadge({ height = 48 }: { height?: number }) {
  const width = (height * 168) / 48
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 168 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Available at Amazon"
    >
      <rect width="168" height="48" rx="6" fill="#131921" />
      <text x="16" y="19" fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif" fontSize="10" letterSpacing="0.2">
        Available at
      </text>
      <text x="14" y="39" fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif" fontSize="23" fontWeight="700" letterSpacing="-1">
        amazon
      </text>
      {/* orange smile arrow from under the 'a' curving up to the 'z' */}
      <path d="M19 41 C 46 50, 86 50, 112 40" stroke="#FF9900" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M112 40 l -7 0.5 l 4.5 -4.5 z" fill="#FF9900" />
    </svg>
  )
}
