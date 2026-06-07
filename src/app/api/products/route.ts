import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getProducts, createProduct } from '@/lib/products'

export async function GET() {
  return NextResponse.json(await getProducts())
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('x-admin-password')
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const product = await createProduct(body)
  revalidatePath('/')
  revalidatePath('/products')
  return NextResponse.json(product, { status: 201 })
}
