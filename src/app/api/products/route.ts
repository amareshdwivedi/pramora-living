import { NextRequest, NextResponse } from 'next/server'
import { getProducts, createProduct } from '@/lib/products'

export async function GET() {
  return NextResponse.json(getProducts())
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('x-admin-password')
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const product = createProduct(body)
  return NextResponse.json(product, { status: 201 })
}
