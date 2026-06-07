import { NextRequest, NextResponse } from 'next/server'

/** Validates the admin password so the login screen reflects real auth. */
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
