export interface Fabric {
  _id: string;
  qualityCode: string;
  qualityName: string;
  type?: string;
  weaver: string;
  weaverQualityName: string;
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
  images: string[];
  createdAt: string;
  updatedAt: string;
}

// New interface for fabric items (similar to order items)
export interface FabricItem {
  qualityCode: string;
  qualityName: string;
  type: string;
  weaver: string;
  weaverQualityName: string;
  rack?: string;
  greighWidth: string;
  finishWidth: string;
  weight: string;
  gsm: string;
  content: string;
  danier: string;
  count: string;
  reed: string;
  pick: string;
  greighRate: string;
  images?: string[];
}

// New interface for fabric form with multiple items
export interface FabricFormData {
  items: FabricItem[];
}

// Legacy interface for backward compatibility
export interface FabricFormDataLegacy {
  qualityCode: string;
  qualityName: string;
  weaver: string;
  weaverQualityName: string;
  greighWidth: string;
  finishWidth: string;
  weight: string;
  gsm: string;
  danier: string;
  reed: string;
  pick: string;
  greighRate: string;
}

export interface QualityName {
  _id: string;
  name: string;
  weavers: Weaver[];
  createdAt: string;
  updatedAt: string;
}

export interface Weaver {
  _id: string;
  name: string;
  qualityNameId: string;
  weaverQualityNames: WeaverQualityName[];
  createdAt: string;
  updatedAt: string;
}

export interface WeaverQualityName {
  _id: string;
  name: string;
  weaverId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FabricFilters {
  qualityCode: string;
  qualityName: string;
  type: string;
  weaver: string;
  weaverQualityName: string;
  search: string;
  minGsm: string;
  maxGsm: string;
  minWeight: string;
  maxWeight: string;
  minRate: string;
  maxRate: string;
  minWidth: string;
  maxWidth: string;
  hasImages: boolean;
  sortBy: 'createdAt' | 'createdAt_asc' | 'qualityName' | 'weaver' | 'gsm' | 'weight' | 'greighRate';
  sortOrder: 'asc' | 'desc';
}

// Validation errors interface
export interface FabricValidationErrors {
  [key: string]: string;
}
