import { supabase } from "@/integrations/supabase/client";
import { lookupBarcodeServerFn } from "@/lib/barcode.functions";
import type { BarcodeLookupResult, BatchInventoryEntry, ProductMaster } from "@/types/product";

const LOCAL_PRODUCT_CACHE_KEY = "rsp_product_master_cache_v1";

/**
 * Reads local cached Product Master items from browser storage.
 * Ensures offline-first capability and instant lookups.
 */
export function getLocalProductCache(): Record<string, ProductMaster> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_PRODUCT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves a product into local persistent cache.
 */
export function saveLocalProductCache(product: ProductMaster): void {
  if (typeof window === "undefined") return;
  try {
    const cache = getLocalProductCache();
    cache[product.barcode] = product;
    localStorage.setItem(LOCAL_PRODUCT_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn("Failed to update local product cache:", err);
  }
}

/**
 * STEP 1: Search the local RSP Medical database.
 * 1. Checks local offline cache.
 * 2. Checks Supabase product_master (if table exists).
 * 3. Checks existing Supabase inventory records (finds any matching batch/item records).
 */
export async function findLocalProduct(barcode: string): Promise<{
  product: ProductMaster | null;
  existingBatches: BatchInventoryEntry[];
}> {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return { product: null, existingBatches: [] };

  // 1. Check local persistent cache
  const cache = getLocalProductCache();
  let cachedProduct = cache[cleanBarcode] || null;

  // 2. Try querying Supabase product_master
  try {
    const { data: pmData, error: pmErr } = await (supabase as any)
      .from("product_master")
      .select("*")
      .or(`barcode.eq.${cleanBarcode},gtin.eq.${cleanBarcode},upc.eq.${cleanBarcode},ean.eq.${cleanBarcode}`)
      .limit(1)
      .maybeSingle();

    if (!pmErr && pmData) {
      cachedProduct = {
        id: pmData.id,
        barcode: pmData.barcode || cleanBarcode,
        gtin: pmData.gtin,
        upc: pmData.upc,
        ean: pmData.ean,
        product_name: pmData.product_name,
        brand_name: pmData.brand_name,
        manufacturer: pmData.manufacturer,
        description: pmData.description,
        category: pmData.category,
        product_type: pmData.product_type,
        pack_size: pmData.pack_size,
        unit: pmData.unit,
        mrp: pmData.mrp ? Number(pmData.mrp) : null,
        hsn_code: pmData.hsn_code,
        gst_percentage: pmData.gst_percentage ? Number(pmData.gst_percentage) : null,
        composition: pmData.composition,
        ingredients: pmData.ingredients,
        product_image_url: pmData.product_image_url,
        source: "local_db",
        source_provider: "RSP Database",
        created_at: pmData.created_at,
        updated_at: pmData.updated_at,
      };
      // Keep local cache synced
      saveLocalProductCache(cachedProduct);
    }
  } catch {
    // product_master table may not exist yet; continue to inventory lookup
  }

  // 3. Find any existing inventory batches in Supabase matching this item
  const existingBatches: BatchInventoryEntry[] = [];
  try {
    // Search inventory table by item_name or batch_code matching
    let query = supabase.from("inventory").select("*");
    if (cachedProduct) {
      query = query.ilike("item_name", cachedProduct.product_name);
    } else {
      query = query.or(`batch_code.eq.${cleanBarcode},item_name.ilike.%${cleanBarcode}%`);
    }

    const { data: invRows } = (await query.limit(20)) as { data: any[] | null };
    if (invRows && invRows.length > 0) {
      for (const row of invRows) {
        existingBatches.push({
          id: row.id,
          barcode: cleanBarcode,
          item_name: row.item_name,
          manufacturer: row.manufacturer,
          type: row.type,
          batch_code: row.batch_code,
          pack_size: row.pack_size,
          no_of_pack: Number(row.no_of_pack),
          units: row.units,
          mrp: Number(row.mrp),
          expiry_month: row.expiry_month,
          expiry_year: row.expiry_year,
          created_at: row.created_at,
        });
      }

      // If we don't have a product_master record yet, build one from the existing inventory row
      if (!cachedProduct && invRows[0]) {
        const first = invRows[0];
        cachedProduct = {
          id: first.id,
          barcode: cleanBarcode,
          product_name: first.item_name,
          brand_name: first.manufacturer,
          manufacturer: first.manufacturer,
          product_type: first.type,
          pack_size: first.pack_size,
          unit: first.units,
          mrp: Number(first.mrp) || null,
          source: "local_db",
          source_provider: "RSP Database",
          created_at: first.created_at,
          updated_at: first.updated_at,
        };
        saveLocalProductCache(cachedProduct);
      }
    }
  } catch (err) {
    console.warn("Inventory batch search error:", err);
  }

  return { product: cachedProduct, existingBatches };
}

/**
 * Universal lookup service following the exact order:
 * STEP 1: Search local RSP Medical database.
 * STEP 2: If not found locally, call configured external product-data API via backend.
 * STEP 3: If found externally, return available info.
 * STEP 4: If not found, return clean not found message.
 */
export async function lookupProductByBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const clean = barcode.trim();
  if (!clean) {
    return {
      found: false,
      message: "Please enter a valid barcode number.",
      errorCode: "INVALID_BARCODE",
    };
  }

  // STEP 1: Local RSP Database lookup first (Offline-First)
  try {
    const { product, existingBatches } = await findLocalProduct(clean);
    if (product) {
      return {
        found: true,
        source: "local_db",
        provider: "RSP Database",
        product,
        existingBatches,
      };
    }
  } catch (err) {
    console.warn("Local DB lookup encountered an issue:", err);
  }

  // STEP 2: Call backend external product-data API
  if (typeof window !== "undefined" && !navigator.onLine) {
    return {
      found: false,
      message: "Internet unavailable. Searching local product database.",
      errorCode: "NETWORK_ERROR",
    };
  }

  try {
    const externalResult = await lookupBarcodeServerFn({
      data: { barcode: clean },
    });
    return externalResult;
  } catch (err: any) {
    console.error("External lookup error:", err);
    return {
      found: false,
      source: "external_api",
      message: "Online product lookup is temporarily unavailable. You can enter the product details manually.",
      errorCode: "SERVICE_UNAVAILABLE",
    };
  }
}

/**
 * Save verified product:
 * 1. Saves to Product Master (local cache + Supabase product_master if table exists)
 * 2. Saves batch to Supabase inventory table
 */
export async function saveVerifiedProduct(params: {
  product: Partial<ProductMaster>;
  batch: {
    batch_code: string;
    pack_size: string;
    no_of_pack: number;
    units: string;
    mrp: number;
    expiry_month: number;
    expiry_year: number;
  };
  userName?: string;
}): Promise<{ success: boolean; productId: string; inventoryId?: string }> {
  const cleanBarcode = (params.product.barcode || "").trim();
  const now = new Date().toISOString();

  const productMasterEntry: ProductMaster = {
    id: params.product.id || crypto.randomUUID(),
    barcode: cleanBarcode,
    gtin: params.product.gtin || cleanBarcode,
    upc: params.product.upc || cleanBarcode,
    ean: params.product.ean || cleanBarcode,
    product_name: (params.product.product_name || "").trim(),
    brand_name: params.product.brand_name?.trim() || null,
    manufacturer: params.product.manufacturer?.trim() || params.product.brand_name?.trim() || "Unknown",
    description: params.product.description?.trim() || null,
    category: params.product.category?.trim() || null,
    product_type: params.product.product_type?.trim() || "Other",
    pack_size: params.batch.pack_size.trim() || params.product.pack_size || "1",
    unit: params.batch.units.trim() || params.product.unit || "Pieces",
    mrp: Number(params.batch.mrp || params.product.mrp || 0),
    hsn_code: params.product.hsn_code?.trim() || null,
    gst_percentage: params.product.gst_percentage ? Number(params.product.gst_percentage) : null,
    composition: params.product.composition?.trim() || null,
    ingredients: params.product.ingredients?.trim() || null,
    product_image_url: params.product.product_image_url || null,
    source: params.product.source || "manual",
    source_provider: params.product.source_provider || "RSP Database",
    created_at: now,
    updated_at: now,
  };

  // 1. Cache product master locally
  if (cleanBarcode) {
    saveLocalProductCache(productMasterEntry);
  }

  // 2. Try inserting into Supabase product_master if table exists
  try {
    await (supabase as any).from("product_master").upsert(
      {
        barcode: productMasterEntry.barcode,
        gtin: productMasterEntry.gtin,
        upc: productMasterEntry.upc,
        ean: productMasterEntry.ean,
        product_name: productMasterEntry.product_name,
        brand_name: productMasterEntry.brand_name,
        manufacturer: productMasterEntry.manufacturer,
        description: productMasterEntry.description,
        category: productMasterEntry.category,
        product_type: productMasterEntry.product_type,
        pack_size: productMasterEntry.pack_size,
        unit: productMasterEntry.unit,
        mrp: productMasterEntry.mrp,
        hsn_code: productMasterEntry.hsn_code,
        gst_percentage: productMasterEntry.gst_percentage,
        composition: productMasterEntry.composition,
        ingredients: productMasterEntry.ingredients,
        product_image_url: productMasterEntry.product_image_url,
        source: productMasterEntry.source,
        source_provider: productMasterEntry.source_provider,
        updated_at: now,
      },
      { onConflict: "barcode" }
    );
  } catch {
    // If table doesn't exist, local cache handles product master seamlessly
  }

  // 3. Save batch to Supabase inventory table
  const { data: invData, error: invError } = await (supabase as any)
    .from("inventory")
    .insert({
      user_name: params.userName || "Operator",
      item_name: productMasterEntry.product_name,
      manufacturer: productMasterEntry.manufacturer || "Unknown",
      type: productMasterEntry.product_type || "Other",
      batch_code: params.batch.batch_code.trim(),
      pack_size: params.batch.pack_size.trim(),
      no_of_pack: Number(params.batch.no_of_pack),
      units: params.batch.units.trim(),
      mrp: Number(params.batch.mrp),
      expiry_month: Number(params.batch.expiry_month),
      expiry_year: Number(params.batch.expiry_year),
    })
    .select("id")
    .single();

  if (invError) {
    console.error("Error inserting inventory batch:", invError);
    throw new Error(invError.message || "Failed to save inventory record");
  }

  return {
    success: true,
    productId: productMasterEntry.id,
    inventoryId: invData?.id,
  };
}
