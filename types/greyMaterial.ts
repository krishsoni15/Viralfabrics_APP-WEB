export interface GreyMaterial {
  _id?: string;
  qualityCode: string;
  qualityName: string;
  type?: string;
  weaver?: string; // Corresponds to Name
  challanNumber?: string;
  piece?: number | string;
  meter?: number | string;
  images?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  // Maintain backward compatibility with UI expecting these fields
  weaverQualityName?: string;
}

export interface GreyMaterialFormData {
  items: GreyMaterial[];
}

export interface GreyMaterialFilters {
  qualityCode?: string;
  qualityName?: string;
  type?: string;
  weaver?: string;
  weaverQualityName?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: any;
}
