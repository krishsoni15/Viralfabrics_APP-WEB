/**
 * Serialization utilities for MongoDB documents
 * Converts MongoDB documents (with ObjectIds) to plain JSON-serializable objects
 */

/**
 * Check if a value is a MongoDB ObjectId
 */
function isObjectId(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  
  // Check for BSON ObjectId
  if ('_bsontype' in value && value._bsontype === 'ObjectId') return true;
  
  // Check for mongoose ObjectId
  if (value.constructor && value.constructor.name === 'ObjectId') return true;
  
  // Check if it has toString and toHexString methods (common ObjectId pattern)
  if (typeof value.toString === 'function' && typeof value.toHexString === 'function') {
    // Additional check: ObjectIds are typically 24 hex characters
    const str = value.toString();
    if (typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Recursively serialize MongoDB documents to plain objects
 * Handles ObjectIds, Dates, and nested objects/arrays
 */
export function serializeMongoDoc<T>(doc: T): T {
  if (doc === null || doc === undefined) {
    return doc;
  }

  // Handle ObjectId
  if (isObjectId(doc)) {
    return (doc as any).toString() as T;
  }

  // Handle Date objects
  if (doc instanceof Date) {
    return doc.toISOString() as T;
  }

  // Handle arrays
  if (Array.isArray(doc)) {
    return doc.map(item => serializeMongoDoc(item)) as T;
  }

  // Handle plain objects
  if (typeof doc === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(doc)) {
      serialized[key] = serializeMongoDoc(value);
    }
    return serialized as T;
  }

  // Primitive values (string, number, boolean, etc.)
  return doc;
}

/**
 * Serialize an array of MongoDB documents
 */
export function serializeMongoDocs<T>(docs: T[]): T[] {
  return docs.map(doc => serializeMongoDoc(doc));
}

