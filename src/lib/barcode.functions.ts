import { createServerFn } from "@tanstack/react-start";
import { cleanProductName, extractMrp, extractPackAndUnit, type RawExternalProductData } from "./barcode-cleaner";
import type { BarcodeLookupResult, ProductMaster } from "../types/product";

interface LookupInput {
  barcode: string;
}

interface TestConnectionInput {
  provider: string;
  apiUrl?: string | undefined;
  apiKey?: string | undefined;
}

/**
 * Server-side lookup handler. Keeps all external API credentials strictly on the backend.
 * Never exposes API keys or secrets to the client.
 */
export const lookupBarcodeServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown): LookupInput => {
    if (!input || typeof input !== "object" || !("barcode" in input)) {
      throw new Error("Invalid request: barcode is required");
    }
    const barcode = String((input as { barcode: string }).barcode).trim();
    if (!barcode) throw new Error("Barcode cannot be empty");
    return { barcode };
  })
  .handler(async ({ data: { barcode } }): Promise<BarcodeLookupResult> => {
    const provider = (process.env["PRODUCT_API_PROVIDER"] || "upcitemdb").toLowerCase();
    const apiKey = process.env["PRODUCT_API_KEY"] || "";
    const apiUrl = process.env["PRODUCT_API_URL"] || "";

    try {
      if (provider === "custom" && apiUrl) {
        return await lookupCustomApi(barcode, apiUrl, apiKey);
      }

      // Default or configured provider: UPCitemdb
      if (provider === "upcitemdb") {
        const upcResult = await lookupUpcItemDb(barcode, apiKey);
        if (upcResult.found) return upcResult;
        // Fallback to OpenProductFacts
        const openResult = await lookupOpenProductFacts(barcode);
        if (openResult.found) return openResult;
        return upcResult;
      }

      // OpenProductFacts provider
      if (provider === "openproductfacts") {
        const openResult = await lookupOpenProductFacts(barcode);
        if (openResult.found) return openResult;
        return await lookupUpcItemDb(barcode, apiKey);
      }

      return {
        found: false,
        source: "external_api",
        provider,
        message: "Product not found. Please enter the product details manually.",
        errorCode: "NOT_FOUND",
      };
    } catch (err: any) {
      console.error("[Barcode Lookup Server Error]:", err);
      return {
        found: false,
        source: "external_api",
        provider,
        message: "Online product lookup is temporarily unavailable. You can enter the product details manually.",
        errorCode: "SERVICE_UNAVAILABLE",
      };
    }
  });

/**
 * Server-side API configuration status check (Admin only).
 * Never exposes the raw API key to the client.
 */
export const getBarcodeConfigStatusServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const provider = process.env["PRODUCT_API_PROVIDER"] || "upcitemdb";
  const apiKey = process.env["PRODUCT_API_KEY"] || "";
  const apiUrl = process.env["PRODUCT_API_URL"] || "";
  const hasKey = Boolean(apiKey.trim());

  // Mask key: show only last 4 chars if long enough
  const maskedKey = hasKey
    ? apiKey.length > 6
      ? `••••••••${apiKey.slice(-4)}`
      : "••••••••"
    : "";

  return {
    provider,
    apiUrl: apiUrl ? apiUrl.replace(/\/\/.*@/, "//") : "", // strip potential credentials
    isConfigured: hasKey || provider === "openproductfacts" || provider === "upcitemdb",
    status: hasKey ? "CONNECTED ✓" : "FREE TIER / ACTIVE ✓",
    hasApiKey: hasKey,
    maskedKey,
  };
});

/**
 * Server-side test connection handler.
 */
export const testBarcodeApiServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown): TestConnectionInput => {
    const data = input as TestConnectionInput;
    return {
      provider: data.provider || "upcitemdb",
      apiUrl: data.apiUrl,
      apiKey: data.apiKey,
    };
  })
  .handler(async ({ data: { provider, apiUrl, apiKey } }) => {
    const key = apiKey || process.env["PRODUCT_API_KEY"] || "";
    // Test with a known universal test barcode (Himalaya Purifying Neem Scrub: 8901138821913)
    const testBarcode = "8901138821913";

    try {
      if (provider === "custom") {
        if (!apiUrl) throw new Error("API URL is required for custom provider");
        const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/${testBarcode}`, {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          signal: AbortSignal.timeout(6000),
        });
        return {
          success: res.ok,
          status: res.status,
          message: res.ok ? "Connected successfully! Custom API responded with 200 OK." : `Custom API responded with HTTP ${res.status}`,
        };
      }

      if (provider === "openproductfacts") {
        const res = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${testBarcode}.json`, {
          signal: AbortSignal.timeout(6000),
        });
        return {
          success: res.ok,
          status: res.status,
          message: res.ok ? "Connected successfully to Open Product Database!" : `Error: HTTP ${res.status}`,
        };
      }

      // UPCitemdb test
      const headers: Record<string, string> = {
        "Accept": "application/json",
        "User-Agent": "RSP-Medical-Billing/1.0",
      };
      if (key) {
        headers["user_key"] = key;
        headers["key_type"] = "3scale";
      }

      const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${testBarcode}`, {
        headers,
        signal: AbortSignal.timeout(7000),
      });

      if (res.status === 429) {
        return {
          success: false,
          status: 429,
          message: "Online lookup limit reached (100 req/day for free tier). Please try again later or add an API key.",
        };
      }

      if (!res.ok) {
        return {
          success: false,
          status: res.status,
          message: `Provider returned status ${res.status}`,
        };
      }

      const json = await res.json();
      return {
        success: true,
        status: 200,
        message: `Connected successfully! Provider found: ${json.items?.[0]?.title?.slice(0, 40) || "Valid response"}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 500,
        message: err.message || "Failed to connect to provider",
      };
    }
  });

/**
 * UPCitemdb lookup implementation
 */
async function lookupUpcItemDb(barcode: string, apiKey?: string): Promise<BarcodeLookupResult> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "RSP-Medical-Billing/1.0",
  };
  if (apiKey) {
    headers["user_key"] = apiKey;
    headers["key_type"] = "3scale";
  }

  let item: RawExternalProductData | undefined;

  // Try search endpoint (as specified by user) and lookup endpoint
  const urls = [
    `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(barcode)}&match_mode=1&type=product`,
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (response.status === 429) {
        return {
          found: false,
          source: "external_api",
          provider: "UPCitemdb",
          message: "Online lookup limit reached. Please try again later or enter the product manually.",
          errorCode: "RATE_LIMITED",
        };
      }

      if (response.ok) {
        const json = await response.json();
        if (json.items && Array.isArray(json.items) && json.items.length > 0) {
          item = json.items[0];
          break;
        }
      }
    } catch {
      // try next endpoint
    }
  }

  if (!item) {
    return {
      found: false,
      source: "external_api",
      provider: "UPCitemdb",
      message: "Product not found. Please enter the product details manually.",
      errorCode: "NOT_FOUND",
    };
  }

  // Extract store titles to find clean retail names (e.g. "Himalaya Purifying Neem Scrub 50g")
  const storeTitles: string[] = [];
  if (item.offers && Array.isArray(item.offers)) {
    for (const o of item.offers) {
      if (o.title) storeTitles.push(o.title);
    }
  }
  if (item.stores && Array.isArray(item.stores)) {
    for (const s of item.stores) {
      if (s.title) storeTitles.push(s.title);
    }
  }

  const brand = (item.brand || "").trim();
  const cleanedTitle = cleanProductName(item.title, brand, storeTitles);
  const mrp = extractMrp(item);
  const { pack_size, unit, product_type } = extractPackAndUnit(cleanedTitle || item.title || "", "");

  const product: Partial<ProductMaster> = {
    barcode,
    gtin: barcode,
    upc: barcode,
    ean: barcode,
    product_name: cleanedTitle || item.title || "",
    brand_name: brand || null,
    manufacturer: brand || item.manufacturer || null,
    description: item.description || null,
    category: item.category || null,
    product_type: product_type || "Other",
    pack_size: pack_size || null,
    unit: unit || null,
    mrp: mrp ?? null,
    product_image_url: item.images?.[0] || null,
    source: "external_api",
    source_provider: "UPCitemdb",
  };

  return {
    found: true,
    source: "external_api",
    provider: "UPCitemdb",
    product,
  };
}

/**
 * OpenProductFacts / OpenBeautyFacts / OpenFoodFacts lookup (Free global barcode database)
 */
async function lookupOpenProductFacts(barcode: string): Promise<BarcodeLookupResult> {
  // Try OpenBeautyFacts first (great for cosmetics, scrubs, creams, soaps, personal care)
  const apis = [
    `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
  ];

  for (const apiUrl of apis) {
    try {
      const res = await fetch(apiUrl, {
        headers: { "User-Agent": "RSP-Medical-Billing/1.0" },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;
      const json = await res.json();
      if (json.status !== 1 || !json.product) continue;

      const p = json.product;
      const brand = p.brands?.split(",")?.[0]?.trim() || "";
      const rawName = p.product_name_en || p.product_name || p.generic_name || "";
      const cleanedTitle = cleanProductName(rawName, brand);
      const { pack_size, unit, product_type } = extractPackAndUnit(cleanedTitle || rawName, p.quantity);

      const product: Partial<ProductMaster> = {
        barcode,
        gtin: barcode,
        upc: barcode,
        ean: barcode,
        product_name: cleanedTitle || rawName,
        brand_name: brand || null,
        manufacturer: brand || null,
        pack_size: p.quantity || pack_size || null,
        unit: unit || null,
        product_type: product_type || "Other",
        product_image_url: p.image_front_url || p.image_url || null,
        source: "external_api",
        source_provider: "OpenProductDatabase",
      };

      return {
        found: true,
        source: "external_api",
        provider: "OpenProductDatabase",
        product,
      };
    } catch {
      // continue to next provider
    }
  }

  return {
    found: false,
    source: "external_api",
    provider: "OpenProductDatabase",
    message: "Product not found. Please enter the product details manually.",
    errorCode: "NOT_FOUND",
  };
}

/**
 * Custom API provider
 */
async function lookupCustomApi(barcode: string, apiUrl: string, apiKey?: string): Promise<BarcodeLookupResult> {
  const url = `${apiUrl.replace(/\/+$/, "")}/${encodeURIComponent(barcode)}`;
  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    return {
      found: false,
      source: "external_api",
      provider: "Custom API",
      message: "Product not found. Please enter the product details manually.",
      errorCode: "NOT_FOUND",
    };
  }

  const json = await res.json();
  const raw: RawExternalProductData = json.data || json.product || json;

  const brand = raw.brand || "";
  const cleanedTitle = cleanProductName(raw.title || raw.product_name, brand);
  const mrp = extractMrp(raw);
  const { pack_size, unit, product_type } = extractPackAndUnit(cleanedTitle, "");

  return {
    found: true,
    source: "external_api",
    provider: "Custom API",
    product: {
      barcode,
      gtin: barcode,
      product_name: cleanedTitle || raw.title || raw.product_name || "",
      brand_name: brand || null,
      manufacturer: raw.manufacturer || brand || null,
      pack_size: raw.category || pack_size || null,
      unit: unit || null,
      product_type: product_type || "Other",
      mrp: mrp ?? null,
      product_image_url: raw.images?.[0] || raw.image_url || null,
      source: "external_api",
      source_provider: "Custom API",
    },
  };
}
