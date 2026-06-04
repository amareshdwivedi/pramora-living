'use client'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const wa = `https://wa.me/919880009575?text=${encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nSubject: ${form.subject}\nMessage: ${form.message}`
    )}`
    window.open(wa, '_blank')
    setSent(true)
    setForm({ name: '', email: '', phone: '', subject: '', message: '' })
  }

  return (
    <div className="container-craft py-16 md:py-24">
      {/* Header */}
      <div className="mb-16 max-w-xl">
        <p className="overline mb-4">Get In Touch</p>
        <h1 className="font-serif text-4xl md:text-5xl mb-4" style={{ color: 'var(--text)' }}>
          We'd love to<br />hear from you
        </h1>
        <div className="rule" />
        <p className="body-text">
          Questions about a piece, custom orders, bulk enquiries, or just a hello — reach out and we'll get back to you promptly.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-20">
        {/* Contact info */}
        <div>
          <div className="space-y-10">
            {[
              { label: 'Address', value: 'Brigade Cornerstone Utopia\nGunjur Village, Varthur\nBengaluru — 560087' },
              { label: 'Phone', value: '+91 98800 09575' },
              { label: 'Email', value: 'hello@pramoraliving.com' },
              { label: 'WhatsApp', value: 'Chat with us directly for orders, enquiries, or gifting assistance.' },
            ].map(item => (
              <div key={item.label}>
                <p className="overline mb-2">{item.label}</p>
                <p className="body-text whitespace-pre-line">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 h-px" style={{ backgroundColor: 'var(--border)' }} />

          <div className="mt-10">
            <p className="overline mb-5">Also Available On</p>
            <div className="flex flex-col gap-3">
              {[
                { label: 'WhatsApp Store', href: 'https://wa.me/919880009575', dot: '#25D366' },
                { label: 'Amazon',         href: 'https://amazon.in',          dot: '#FF9900' },
                { label: 'Flipkart',       href: 'https://flipkart.com',       dot: '#2874F0' },
                { label: 'Meesho',         href: 'https://meesho.com',         dot: '#9B2D8E' },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 text-sm font-light transition-opacity hover:opacity-50"
                  style={{ color: 'var(--text-2)' }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.dot }} />
                  {l.label}
                  <ArrowRight size={12} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Form */}
        <div>
          {sent ? (
            <div className="py-16 text-center">
              <p className="font-serif text-3xl mb-4" style={{ color: 'var(--text)' }}>Thank you.</p>
              <p className="body-text mb-8">Your message has been opened in WhatsApp. We'll reply shortly.</p>
              <button onClick={() => setSent(false)} className="btn-secondary">Send another message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <label className="craft-label">Your Name *</label>
                  <input className="craft-input" required value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" />
                </div>
                <div>
                  <label className="craft-label">Email *</label>
                  <input className="craft-input" type="email" required value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} placeholder="priya@example.com" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <label className="craft-label">Phone</label>
                  <input className="craft-input" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="craft-label">Subject *</label>
                  <input className="craft-input" required value={form.subject}
                    onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Product Enquiry" />
                </div>
              </div>
              <div>
                <label className="craft-label">Message *</label>
                <textarea
                  className="craft-input resize-none"
                  rows={5}
                  required
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us what you're looking for..."
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Send via WhatsApp
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
