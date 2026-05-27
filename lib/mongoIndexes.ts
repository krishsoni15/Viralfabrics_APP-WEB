/**
 * MongoDB Index Recommendations for Optimal Performance
 * 
 * Run these indexes in your MongoDB database to improve query performance.
 * 
 * Usage:
 * 1. Connect to your MongoDB database
 * 2. Run these index creation commands
 * 3. Monitor query performance improvements
 * 
 * You can create these indexes using MongoDB Compass, mongosh, or your preferred MongoDB client.
 */

export const MONGO_INDEXES = {
  // ============================================================================
  // ORDER INDEXES
  // ============================================================================
  orders: [
    // Primary query indexes
    { orderId: 1 }, // For orderId lookups
    { status: 1, createdAt: -1 }, // For status filtering with date sorting
    { orderType: 1, createdAt: -1 }, // For order type filtering
    { party: 1, createdAt: -1 }, // For party-based queries
    { deliveryDate: 1 }, // For date range queries
    { createdAt: -1 }, // For default sorting (latest first)
    { softDeleted: 1, createdAt: -1 }, // For soft delete filtering
    
    // Compound indexes for common queries
    { status: 1, orderType: 1, createdAt: -1 }, // Status + type filtering
    { party: 1, status: 1, createdAt: -1 }, // Party + status filtering
    { deliveryDate: 1, status: 1 }, // Date range + status
    
    // Text search indexes
    { orderId: 'text', poNumber: 'text', styleNo: 'text', contactName: 'text' }, // Text search
  ],

  // ============================================================================
  // PARTY INDEXES
  // ============================================================================
  parties: [
    { name: 1 }, // For name lookups and sorting
    { name: 'text' }, // For text search
    { createdAt: -1 }, // For date sorting
  ],

  // ============================================================================
  // QUALITY INDEXES
  // ============================================================================
  qualities: [
    { name: 1 }, // For name lookups and sorting
    { name: 'text' }, // For text search
    { isActive: 1, name: 1 }, // For active qualities with name sorting
    { createdAt: -1 }, // For date sorting
  ],

  // ============================================================================
  // MILL INDEXES
  // ============================================================================
  mills: [
    { name: 1 }, // For name lookups
    { name: 'text' }, // For text search
    { createdAt: -1 }, // For date sorting
  ],

  // ============================================================================
  // MILL INPUT INDEXES
  // ============================================================================
  millinputs: [
    { order: 1, createdAt: -1 }, // For order-based queries
    { mill: 1, createdAt: -1 }, // For mill-based queries
    { order: 1, mill: 1 }, // Compound for order + mill queries
    { millDate: -1 }, // For date sorting
  ],

  // ============================================================================
  // MILL OUTPUT INDEXES
  // ============================================================================
  milloutputs: [
    { order: 1, createdAt: -1 }, // For order-based queries
    { recdDate: -1 }, // For date sorting
  ],

  // ============================================================================
  // LAB INDEXES
  // ============================================================================
  labs: [
    { order: 1, createdAt: -1 }, // For order-based queries
    { orderItemId: 1 }, // For item-based queries
    { status: 1, createdAt: -1 }, // For status filtering
    { softDeleted: 1, order: 1 }, // For soft delete filtering
  ],

  // ============================================================================
  // DISPATCH INDEXES
  // ============================================================================
  dispatches: [
    { order: 1, createdAt: -1 }, // For order-based queries
    { dispatchDate: -1 }, // For date sorting
  ],

  // ============================================================================
  // FABRIC INDEXES
  // ============================================================================
  fabrics: [
    { qualityCode: 1 }, // For quality code lookups
    { qualityName: 'text' }, // For text search
    { weaver: 1 }, // For weaver filtering
  ],

  // ============================================================================
  // GREY INFO INDEXES
  // ============================================================================
  greyinfos: [
    { orderId: 1, createdAt: -1 }, // For order-based queries
    { order: 1, createdAt: -1 }, // For order reference queries
    { quality: 1 }, // For quality filtering
  ],
};

/**
 * Generate MongoDB index creation commands
 * 
 * Usage in mongosh:
 * const indexes = require('./lib/mongoIndexes').MONGO_INDEXES;
 * // Then run: db.orders.createIndex({ status: 1, createdAt: -1 })
 */
export function getIndexCommands() {
  const commands: string[] = [];
  
  Object.entries(MONGO_INDEXES).forEach(([collection, indexes]) => {
    indexes.forEach((index, idx) => {
      const indexStr = JSON.stringify(index).replace(/"/g, '');
      commands.push(`db.${collection}.createIndex(${indexStr});`);
    });
  });
  
  return commands;
}

/**
 * Recommended indexes for immediate performance improvement
 * These are the most critical indexes that will have the biggest impact
 */
export const CRITICAL_INDEXES = [
  // Orders - most queried collection
  'db.orders.createIndex({ status: 1, createdAt: -1 });',
  'db.orders.createIndex({ orderId: 1 });',
  'db.orders.createIndex({ softDeleted: 1, createdAt: -1 });',
  
  // Parties - frequently joined
  'db.parties.createIndex({ name: 1 });',
  
  // Qualities - frequently joined
  'db.qualities.createIndex({ name: 1 });',
  'db.qualities.createIndex({ isActive: 1, name: 1 });',
  
  // Mill Inputs - for filtering orders by mill
  'db.millinputs.createIndex({ order: 1, mill: 1 });',
  'db.millinputs.createIndex({ mill: 1, createdAt: -1 });',
];

/**
 * Create indexes script (for use in MongoDB shell or Node.js)
 */
export async function createIndexes(db: any) {
  const results: any[] = [];
  
  for (const [collection, indexes] of Object.entries(MONGO_INDEXES)) {
    for (const index of indexes) {
      try {
        const result = await db.collection(collection).createIndex(index);
        results.push({ collection, index, result, success: true });
      } catch (error: any) {
        results.push({ collection, index, error: error.message, success: false });
      }
    }
  }
  
  return results;
}

