/**
 * Search and filter utility functions
 * Centralized search logic for orders and other entities
 */

import { Order, Party, Quality, Mill } from '@/types';

// ============================================================================
// SEARCH TYPES
// ============================================================================

export type SearchType =
  | 'all'
  | 'orderId'
  | 'poNumber'
  | 'styleNo'
  | 'party'
  | 'quality'
  | 'mill';

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search orders by various criteria
 */
export function searchOrders(
  orders: Order[],
  searchTerm: string,
  searchType: SearchType = 'all',
  parties: Party[] = [],
  qualities: Quality[] = [],
  mills: Mill[] = []
): Order[] {
  if (!searchTerm.trim()) return orders;

  const term = searchTerm.toLowerCase().trim();

  return orders.filter((order) => {
    switch (searchType) {
      case 'orderId':
        return order.orderId?.toLowerCase().includes(term) ?? false;

      case 'poNumber':
        return order.poNumber?.toLowerCase().includes(term) ?? false;

      case 'styleNo':
        return order.styleNo?.toLowerCase().includes(term) ?? false;

      case 'party': {
        const partyId = typeof order.party === 'string' ? order.party : order.party?._id;
        const party = parties.find((p) => p._id === partyId);
        return party?.name.toLowerCase().includes(term) ?? false;
      }

      case 'quality': {
        const hasMatchingQuality = order.items?.some((item) => {
          const qualityId =
            typeof item.quality === 'string' ? item.quality : item.quality?._id;
          const quality = qualities.find((q) => q._id === qualityId);
          return quality?.name.toLowerCase().includes(term) ?? false;
        });
        return hasMatchingQuality ?? false;
      }

      case 'mill': {
        const millIds = new Set<string>();
        order.millInputs?.forEach((input: any) => {
          const millId = typeof input.mill === 'string' ? input.mill : input.mill?._id;
          if (millId) millIds.add(millId);
        });
        const hasMatchingMill = Array.from(millIds).some((millId) => {
          const mill = mills.find((m) => m._id === millId);
          return mill?.name.toLowerCase().includes(term) ?? false;
        });
        return hasMatchingMill ?? false;
      }

      case 'all':
      default:
        return (
          order.orderId?.toLowerCase().includes(term) ||
          order.poNumber?.toLowerCase().includes(term) ||
          order.styleNo?.toLowerCase().includes(term) ||
          (() => {
            const partyId =
              typeof order.party === 'string' ? order.party : order.party?._id;
            const party = parties.find((p) => p._id === partyId);
            return party?.name.toLowerCase().includes(term) ?? false;
          })() ||
          order.items?.some((item) => {
            const qualityId =
              typeof item.quality === 'string' ? item.quality : item.quality?._id;
            const quality = qualities.find((q) => q._id === qualityId);
            return quality?.name.toLowerCase().includes(term) ?? false;
          }) ||
          false
        );
    }
  });
}

/**
 * Filter orders by status
 */
export function filterOrdersByStatus(
  orders: Order[],
  status: string | null
): Order[] {
  if (!status || status === 'all') return orders;
  return orders.filter((order) => order.status === status);
}

/**
 * Filter orders by type
 */
export function filterOrdersByType(
  orders: Order[],
  type: string | null
): Order[] {
  if (!type || type === 'all') return orders;
  return orders.filter((order) => order.orderType === type);
}

/**
 * Filter orders by mill
 */
export function filterOrdersByMill(
  orders: Order[],
  millId: string | null,
  mills: Mill[] = []
): Order[] {
  if (!millId || millId === 'all') return orders;

  return orders.filter((order) => {
    const millIds = new Set<string>();
    order.millInputs?.forEach((input: any) => {
      const id = typeof input.mill === 'string' ? input.mill : input.mill?._id;
      if (id) millIds.add(id);
    });
    return millIds.has(millId);
  });
}

/**
 * Sort orders by various criteria
 */
export type SortField = 'orderId' | 'arrivalDate' | 'deliveryDate' | 'status' | 'priority';
export type SortDirection = 'asc' | 'desc';

export function sortOrders(
  orders: Order[],
  field: SortField,
  direction: SortDirection = 'asc'
): Order[] {
  const sorted = [...orders].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'orderId':
        comparison = (a.orderId || '').localeCompare(b.orderId || '');
        break;

      case 'arrivalDate':
        comparison =
          new Date(a.arrivalDate || 0).getTime() -
          new Date(b.arrivalDate || 0).getTime();
        break;

      case 'deliveryDate':
        comparison =
          new Date(a.deliveryDate || 0).getTime() -
          new Date(b.deliveryDate || 0).getTime();
        break;

      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;

      case 'priority':
        // Assuming priority is a number field
        comparison = ((a as any).priority || 0) - ((b as any).priority || 0);
        break;

      default:
        return 0;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Debounce search function
 */
export function createDebouncedSearch(
  callback: (term: string) => void,
  delay: number = 300
): (term: string) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (term: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback(term);
    }, delay);
  };
}

