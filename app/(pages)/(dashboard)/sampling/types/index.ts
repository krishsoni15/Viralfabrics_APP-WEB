/**
 * Shared Type Definitions for Sampling Module
 * 
 * All shared types should be imported from this file to ensure consistency
 */

export interface Weaver {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
}

export interface Sample {
  _id: string;
  weaverId: string | Weaver | {
    _id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  qualityName: string;
  type?: string;
  rack?: string;
  greighWidth: number;
  finishWidth: number;
  weight: number;
  gsm: number;
  content: string;
  danier: string;
  count: number;
  reed: number;
  pick: number;
  greighRate: number;
  label: string;
  note?: string;
  images: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Re-export service types for convenience
export type { WeaverData, WeaverQueryParams } from '../lib/services/weaverService';
export type { SampleData, SampleQueryParams } from '../lib/services/sampleService';

