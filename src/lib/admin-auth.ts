import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const ADMIN_SESSION_COOKIE = 'pramora_admin_session'

const globalAuth = globalThis as typeof globalThis & {
  __pramoraAdminSessionToken?: string
}

// Local sessions live only for the running server process. In production,
// route handlers may run in separate processes, so they derive the same opaque
// token from the server-only admin password.
const productionToken = process.env.ADMIN_PASSWORD
  ? createHmac('sha256', process.env.ADMIN_PASSWORD).update('pramora-admin-session-v1').digest('base64url')
  : null
const sessionToken = process.env.NODE_ENV === 'production' && productionToken
  ? productionToken
  : globalAuth.__pramoraAdminSessionToken ?? randomBytes(32).toString('base64url')
globalAuth.__pramoraAdminSessionToken = sessionToken

function safelyMatches(value: string | undefined, expected: string | undefined) {
  if (!value || !expected) return false
  const actualBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export function hasAdminSession(req: NextRequest) {
  return safelyMatches(req.cookies.get(ADMIN_SESSION_COOKIE)?.value, sessionToken)
}

export function hasValidAdminPassword(req: NextRequest) {
  return safelyMatches(req.headers.get('x-admin-password') ?? undefined, process.env.ADMIN_PASSWORD)
}

export function isAdminRequest(req: NextRequest) {
  return hasAdminSession(req)
}

export function setAdminSession(res: NextResponse) {
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}

export function clearAdminSession(res: NextResponse) {
  res.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
