'use client'
import { useState, useRef } from 'react'
import { MapPin, Phone, Mail, MessageCircle, Send } from 'lucide-react'
import { whatsappUrl, PHONE_DISPLAY } from '@/lib/contact'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  // Readable, multi-line summary of the form used by both WhatsApp and email.
  const summary = () =>
    `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nSubject: ${form.subject}\n\nMessage:\n${form.message}`

  const reset = () => setForm({ name: '', email: '', phone: '', subject: '', message: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    window.open(whatsappUrl(summary()), '_blank')
    setSuccessMsg("Your message has been opened in WhatsApp. We'll get back to you shortly.")
    setSent(true)
    reset()
  }

  const sendEmail = async () => {
    // Enforce the same required fields as the WhatsApp submit.
    if (formRef.current && !formRef.current.reportValidity()) return
    setSending(true)
    setErr('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSuccessMsg("Your message has been emailed to Pramora Living. We'll get back to you shortly.")
        setSent(true)
        reset()
      } else {
        setErr(data.error || 'Could not send email. Please try WhatsApp.')
      }
    } catch {
      setErr('Could not send email. Please try WhatsApp.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--gold)' }}>Get In Touch</p>
        <h1 className="section-title">Contact Us</h1>
        <div className="divider mx-auto" />
        <p className="section-subtitle mx-auto text-center">
          Have a question or want to place a custom order? We'd love to hear from you.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Info */}
        <div>
          <h2 className="font-serif text-2xl font-medium mb-8" style={{ color: 'var(--text)' }}>Let's Connect</h2>
          <div className="space-y-6">
            {[
              { icon: MapPin, label: 'Address', value: 'Brigade Cornerstone Utopia, Gunjur Village\nVarthur, Bengaluru — 560087' },
              { icon: Phone, label: 'Phone', value: PHONE_DISPLAY },
              { icon: Mail, label: 'Email', value: 'pramoraliving@gmail.com' },
              { icon: MessageCircle, label: 'WhatsApp', value: 'Chat with us directly' },
            ].map(item => (
              <div key={item.label} className="flex gap-4">
                <div className="w-10 h-10 flex items-center justify-center border flex-shrink-0" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                  <item.icon size={18} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-2)' }}>{item.label}</p>
                  <p className="text-sm whitespace-pre-line font-medium" style={{ color: 'var(--text)' }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp CTA */}
          <a
            href={whatsappUrl('Hi, I have an enquiry about Pramora Living')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold mt-10 inline-flex"
          >
            <MessageCircle size={16} /> Chat on WhatsApp
          </a>
        </div>

        {/* Form */}
        <div className="card p-8">
          {sent ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-4">✓</div>
              <h3 className="font-serif text-xl mb-2" style={{ color: 'var(--text)' }}>Message Sent!</h3>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                {successMsg}
              </p>
              <button onClick={() => setSent(false)} className="btn-outline mt-6">Send Another</button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="label">Your Name *</label>
                  <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input className="input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="priya@example.com" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="label">Subject *</label>
                  <input className="input" required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Product Enquiry" />
                </div>
              </div>
              <div>
                <label className="label">Message *</label>
                <textarea
                  className="input resize-none"
                  rows={5}
                  required
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us what you're looking for..."
                />
              </div>
              {err && <p className="text-red-500 text-sm">{err}</p>}
              <div className="grid sm:grid-cols-2 gap-3">
                <button type="submit" className="btn-gold w-full justify-center">
                  <Send size={16} /> Send via WhatsApp
                </button>
                <button type="button" onClick={sendEmail} disabled={sending} className="btn-outline w-full justify-center">
                  <Mail size={16} /> {sending ? 'Sending…' : 'Send via Email'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
