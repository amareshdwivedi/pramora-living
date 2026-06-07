/** Central contact details so the WhatsApp number lives in one place. */
export const WHATSAPP_NUMBER = '919353124508' // wa.me format (country code + number)
export const PHONE_DISPLAY = '+91 93531 24508'

/** Public site origin, used to build shareable item links in messages. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://www.pramoraliving.com'

/** Build a WhatsApp click-to-chat URL with a prefilled message. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

/** Contact inbox + a prefilled mailto link builder. */
export const CONTACT_EMAIL = 'pramoraliving@gmail.com'
export function mailtoUrl(subject: string, body: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
