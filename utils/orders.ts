/**
 * Order-related utility functions
 * Extracted from OrdersClient for reusability and testability
 */

import { Order } from '@/types';
import { getHighestPriorityProcess as getHighestPriorityProcessUtil } from '@/lib/processUtils';

/**
 * Get highest priority process from mill input data
 * Uses the centralized process utilities
 */
export function getHighestPriorityProcessFromData(
  processData: { mainProcess?: string; additionalProcesses?: string[] } | null | undefined,
  qualityName?: string
): string | null {
  if (!processData) return null;

  const allProcesses = [
    processData.mainProcess,
    ...(processData.additionalProcesses || []),
  ].filter((process): process is string => !!process && process.trim() !== '');

  if (allProcesses.length === 0) return null;

  return getHighestPriorityProcessUtil(allProcesses);
}

/**
 * Filter out deleted orders from a list
 */
export function filterDeletedOrders(
  orders: Order[],
  deletedIds: Set<string>
): Order[] {
  return orders.filter((order) => {
    const orderId = order._id || '';
    const orderIdStr = order.orderId || '';
    return (
      !deletedIds.has(String(orderId)) && !deletedIds.has(String(orderIdStr))
    );
  });
}

/**
 * Safely set orders state, filtering deleted orders
 */
export function createSafeOrdersSetter(
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>,
  deletedIds: React.MutableRefObject<Set<string>>
) {
  return (ordersData: Order[] | ((prev: Order[]) => Order[])) => {
    const filterDeleted = (ordersList: Order[]) =>
      filterDeletedOrders(ordersList, deletedIds.current);

    if (typeof ordersData === 'function') {
      setOrders((prevOrders: Order[]) => {
        const result = ordersData(prevOrders);
        const safeOrders = Array.isArray(result) ? result : [];
        return filterDeleted(safeOrders);
      });
      return;
    }

    const safeOrders = Array.isArray(ordersData) ? ordersData : [];
    setOrders(filterDeleted(safeOrders));
  };
}

/**
 * Check if an order has mill inputs
 */
export function hasMillInputs(order: Order): boolean {
  return Array.isArray(order.millInputs) && order.millInputs.length > 0;
}

/**
 * Check if an order has mill outputs
 */
export function hasMillOutputs(order: Order): boolean {
  return Array.isArray(order.millOutputs) && order.millOutputs.length > 0;
}

/**
 * Check if an order has dispatches
 */
export function hasDispatches(order: Order): boolean {
  return Array.isArray(order.dispatches) && order.dispatches.length > 0;
}

/**
 * Check if an order has grey information
 */
export function hasGreyInfo(order: Order): boolean {
  return (
    Array.isArray(order.greyInformation) && order.greyInformation.length > 0
  );
}

/**
 * Get order display name (orderId or fallback)
 */
export function getOrderDisplayName(order: Order): string {
  return order.orderId || order._id || 'Unknown Order';
}

/**
 * Format order status for display
 */
export function formatOrderStatus(status?: string): string {
  if (!status) return 'Not Set';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Check if order is in a completed state
 */
export function isOrderCompleted(order: Order): boolean {
  return order.status === 'completed' || order.status === 'delivered';
}

/**
 * Check if order is cancelled
 */
export function isOrderCancelled(order: Order): boolean {
  return order.status === 'cancelled';
}

/**
 * Calculate order total from items
 */
export function calculateOrderTotal(order: Order): number {
  if (!Array.isArray(order.items)) return 0;
  return order.items.reduce((total, item) => {
    const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) || 0 : item.quantity || 0;
    const rate = typeof item.salesRate === 'string' ? parseFloat(item.salesRate) || 0 : item.salesRate || 0;
    return total + quantity * rate;
  }, 0);
}
/**
 * Extract display-friendly order ID (strips FY prefix)
 * e.g. "FY2526-001" → "001", "042" → "042" (legacy)
 */
export function getDisplayOrderId(orderId?: string | null): string {
  if (!orderId) return '';
  const idStr = String(orderId);
  // Aggressively strip any FY block (e.g. FY2728, FY2627-) from anywhere in the string
  return idStr.replace(/FY\s*\d{4}\s*-?\s*/gi, '').trim();
}
