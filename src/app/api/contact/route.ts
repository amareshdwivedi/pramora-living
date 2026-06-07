import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { CONTACT_EMAIL } from '@/lib/contact'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Email isn’t set up yet. Please use WhatsApp for now.' },
      { status: 503 },
    )
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim()
  const phone = (body.phone ?? '').trim()
  const subject = (body.subject ?? '').trim()
  const message = (body.message ?? '').trim()

  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { error: 'Please fill in name, email, subject and message.' },
      { status: 400 },
    )
  }

  const text =
    `New enquiry from the Pramora Living website\n\n` +
    `Name: ${name}\n` +
    `Email: ${email}\n` +
    `Phone: ${phone || '—'}\n` +
    `Subject: ${subject}\n\n` +
    `Message:\n${message}\n`

  const html = `
    <h2>New enquiry from the Pramora Living website</h2>
    <p><strong>Name:</strong> ${esc(name)}</p>
    <p><strong>Email:</strong> ${esc(email)}</p>
    <p><strong>Phone:</strong> ${esc(phone) || '—'}</p>
    <p><strong>Subject:</strong> ${esc(subject)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${esc(message)}</p>
  `

  // Defaults to Resend's shared sender (works on the free tier with no domain
  // setup); override RESEND_FROM once a domain is verified.
  const from = process.env.RESEND_FROM || 'Pramora Living <onboarding@resend.dev>'

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `Pramora Living enquiry: ${subject}`,
      text,
      html,
    })
    if (error) {
      console.error('Resend send error:', error)
      return NextResponse.json(
        { error: 'Could not send email. Please try WhatsApp.' },
        { status: 502 },
      )
    }
  } catch (e) {
    console.error('Resend exception:', e)
    return NextResponse.json(
      { error: 'Could not send email. Please try WhatsApp.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
