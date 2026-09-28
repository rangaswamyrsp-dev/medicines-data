export interface ProductMaster {
  id: string;
  barcode: string;
  gtin?: string | null;
  upc?: string | null;
  ean?: string | null;
  product_name: string;
  brand_name?: string | null;
  manufacturer?: string | null;
  description?: string | null;
  category?: string | null;
  product_type?: string | null;
  pack_size?: string | null;
  unit?: string | null;
  mrp?: number | null;
  hsn_code?: string | null;
  gst_percentage?: number | null;
  composition?: string | null;
  ingredients?: string | null;
  product_image_url?: string | null;
  source: "local_db" | "external_api" | "manual";
  source_provider?: string | null;
  source_product_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchInventoryEntry {
  id?: string;
  product_id?: string | null;
  barcode?: string | null;
  item_name: string;
  manufacturer: string;
  type: string;
  batch_code: string;
  pack_size: string;
  no_of_pack: number;
  units: string;
  mrp: number;
  expiry_month: number;
  expiry_year: number;
  created_at?: string;
  updated_at?: string;
}

export type BarcodeLookupStatus = 
  | "idle"
  | "scanning"
  | "searching"
  | "found_local"
  | "found_external"
  | "not_found"
  | "error";

export interface BarcodeLookupResult {
  found: boolean;
  source?: "local_db" | "external_api";
  provider?: string;
  product?: Partial<ProductMaster>;
  existingBatches?: BatchInventoryEntry[];
  message?: string;
  errorCode?: "NOT_FOUND" | "RATE_LIMITED" | "NETWORK_ERROR" | "SERVICE_UNAVAILABLE" | "INVALID_BARCODE";
}

export interface BarcodeApiConfig {
  provider: "upcitemdb" | "openproductfacts" | "custom";
  apiUrl?: string;
  apiKey?: string;
  isEnabled: boolean;
}
