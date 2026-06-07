/**
 * Product data access.
 *
 * Backed by Neon Postgres (see src/lib/db/). All functions are async.
 * The old JSON-file implementation was removed: Vercel's filesystem is
 * read-only at runtime, so admin writes silently failed in production.
 */
export {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from './db/products.repo'
