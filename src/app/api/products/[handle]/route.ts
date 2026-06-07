import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getProduct, updateProduct, deleteProduct } from '@/lib/products'

function auth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

function revalidate(handle: string) {
  revalidatePath('/')
  revalidatePath('/products')
  revalidatePath(`/products/${handle}`)
}

export async function GET(_: NextRequest, { params }: { params: { handle: string } }) {
  const product = await getProduct(params.handle)
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(req: NextRequest, { params }: { params: { handle: string } }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const updated = await updateProduct(params.handle, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  revalidate(params.handle)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { handle: string } }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ok = await deleteProduct(params.handle)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  revalidate(params.handle)
  return NextResponse.json({ success: true })
}
