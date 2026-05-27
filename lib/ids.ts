import mongoose from 'mongoose';

// Utility functions for ObjectId validation
export const isValidObjectId = (str: string): boolean => {
  return mongoose.Types.ObjectId.isValid(str);
};

export const validateObjectId = (str: string, fieldName: string = 'ID'): void => {
  if (!isValidObjectId(str)) {
    throw new Error(`${fieldName} must be a valid ObjectId`);
  }
};

// Helper to ensure order item exists in order
export const ensureOrderItemExists = async (orderId: string, orderItemId: string) => {
  const Order = mongoose.model('Order');
  const order = await Order.findById(orderId);
  
  if (!order) {
    throw new Error('Order not found');
  }
  
  // Check if items array exists and has items
  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    throw new Error('Order has no items');
  }
  
  // Check if the orderItemId exists in the items array
  const itemExists = order.items.some((item: any) => {
    // Handle both cases: item has _id or we're checking by index
    if (item._id) {
      return item._id.toString() === orderItemId;
    }
    // If no _id, this might be a new item that hasn't been saved yet
    // In this case, we'll allow it to pass through
    return false;
  });
  
  // If item doesn't exist by _id, check if orderItemId is a valid index
  if (!itemExists) {
    const itemIndex = parseInt(orderItemId);
    if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= order.items.length) {
      throw new Error('Order item not found');
    }
  }
  
  return order;
};
