import { NextRequest, NextResponse } from 'next/server'
import { clearAdminSession, hasAdminSession, hasValidAdminPassword, setAdminSession } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true })
}

export async function POST(req: NextRequest) {
  if (!hasValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const res = NextResponse.json({ authenticated: true })
  setAdminSession(res)
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ authenticated: false })
  clearAdminSession(res)
  return res
}
