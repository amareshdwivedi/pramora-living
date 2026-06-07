/**
 * Normalized Amazon listing record — the source-agnostic shape the sync
 * consumes. Both the CSV parser (Phase 2) and a future SP-API client
 * (Phase 3) produce this same type, so the sync core never changes.
 */
export interface AmazonRecord {
  amazonSku: string
  asin: string | null
  title: string
  status: string | null            // "Active" / "Inactive"
  currentPrice: number | null
  buyBoxPrice: number | null
  availableInventory: string | null // raw, e.g. "2 (FBM)"
  totalFees: number | null
  lastChanged: string | null        // ISO date "YYYY-MM-DD"
}
