/**
 * Smart product title and attributes cleaner for barcode lookups.
 * Transforms cluttered SEO titles (e.g. "Ayurvedic Azadirachta Indica 50gm Purifying Neem Scrub 4 Dead Skin Blackhead")
 * into clean, standard retail product names (e.g. "Himalaya Purifying Neem Scrub 50g").
 */

export interface RawExternalProductData {
  title?: string;
  brand?: string;
  manufacturer?: string;
  description?: string;
  category?: string;
  lowest_recorded_price?: number | null;
  highest_recorded_price?: number | null;
  msrp?: number | null;
  images?: string[];
  offers?: Array<{
    merchant?: string;
    title?: string;
    price?: number | string | null;
    currency?: string;
  }>;
  stores?: Array<{
    name?: string;
    title?: string;
    price?: number | string | null;
  }>;
  // OpenFoodFacts / OpenBeautyFacts attributes:
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  image_url?: string;
  image_front_url?: string;
  categories_tags?: string[];
}

export function cleanProductName(
  rawTitle: string | undefined,
  brand: string | undefined,
  storeTitles: string[] = []
): string {
  // 1. If any store listing has a clean, concise title (between 10 and 60 chars), prefer it!
  for (const st of storeTitles) {
    const trimmed = (st || "").trim();
    if (trimmed && trimmed.length >= 8 && trimmed.length <= 65 && !isKeywordStuffed(trimmed)) {
      return formatTitleWithBrand(trimmed, brand);
    }
  }

  if (!rawTitle) return brand ? `${brand} Product` : "";

  let cleaned = rawTitle.trim();

  // 2. Remove common eCommerce/SEO keyword stuffing patterns
  cleaned = cleaned
    // Remove "Online at best price...", "Free Shipping...", "Buy ..."
    .replace(/(?:buy|order|online|best price|free shipping|imported from).*/gi, "")
    // Remove "... 4 Dead Skin Blackhead..." or similar symptom/claim lists
    .replace(/\b(?:for|4)\s+(?:dead skin|blackheads?|pimples?|acne|dry skin|oily skin|glowing skin|men|women|kids?)\b.*/gi, "")
    // Remove promotional trailing notes
    .replace(/\|\s*.*$/g, "")
    .replace(/\s*-\s*(?:amazon|flipkart|rakuten|walmart|ebay).*$/gi, "")
    // Remove bracketed SEO tags like [Pack of 1], (Set of 2), etc.
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\(\s*(?:pack|set|combo|box|bottle|strip)\s+of\s+\d+\s*\)/gi, "")
    // Clean redundant botanical binomial terms if followed by standard brand name
    // e.g. "Ayurvedic Azadirachta Indica 50gm Purifying Neem Scrub" -> "Purifying Neem Scrub 50gm"
    .replace(/^Ayurvedic\s+[A-Za-z\s]+Indica\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If cleaning resulted in something too short, fall back to initial title
  if (cleaned.length < 5) {
    cleaned = rawTitle.trim();
  }

  // 3. Ensure brand prefix is clean and not duplicated
  return formatTitleWithBrand(cleaned, brand);
}

function isKeywordStuffed(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes("online at") ||
    lower.includes("best price") ||
    lower.includes("free delivery") ||
    lower.split(",").length > 3
  );
}

function formatTitleWithBrand(title: string, brand?: string): string {
  if (!brand || !brand.trim()) return title;
  const b = brand.trim();
  const lowerTitle = title.toLowerCase();
  const lowerBrand = b.toLowerCase();

  // If title already starts with brand, return as is
  if (lowerTitle.startsWith(lowerBrand)) {
    return title;
  }

  // If brand is present inside title elsewhere, leave title as is
  if (lowerTitle.includes(lowerBrand)) {
    return title;
  }

  // Otherwise prepend brand
  return `${b} ${title}`.trim();
}

/**
 * Extracts best price/MRP from raw external API responses.
 */
export function extractMrp(data: RawExternalProductData): number | null {
  // Check store / offers first
  const allOffers = [...(data.offers || []), ...(data.stores || [])];
  for (const offer of allOffers) {
    if (offer.price !== undefined && offer.price !== null) {
      const num = typeof offer.price === "number" ? offer.price : parseFloat(String(offer.price).replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num > 0) {
        return Math.round(num * 100) / 100;
      }
    }
  }

  if (typeof data.msrp === "number" && data.msrp > 0) {
    return Math.round(data.msrp * 100) / 100;
  }

  if (typeof data.lowest_recorded_price === "number" && data.lowest_recorded_price > 0) {
    return Math.round(data.lowest_recorded_price * 100) / 100;
  }

  if (typeof data.highest_recorded_price === "number" && data.highest_recorded_price > 0) {
    return Math.round(data.highest_recorded_price * 100) / 100;
  }

  return null;
}

/**
 * Extracts pack size and unit from title, description, or quantity.
 * e.g. "50g", "100ml", "10 Tablets", "15ml"
 */
export function extractPackAndUnit(
  title: string,
  quantity?: string
): { pack_size: string; unit: string; product_type: string } {
  const combined = `${title} ${quantity || ""}`.toLowerCase();

  let pack_size = "";
  let unit = "";
  let product_type = "Other";

  // Match sizes like 50g, 50gm, 100ml, 200ml, 10x10, 10 tabs, etc.
  const sizeMatch = combined.match(/\b(\d+(?:\.\d+)?)\s*(gm|g|ml|mg|kg|tablets?|capsules?|tabs?|caps?|pcs?|sachets?|bottles?|strips?)\b/i);
  if (sizeMatch && sizeMatch[1] && sizeMatch[2]) {
    const num = sizeMatch[1];
    const u = sizeMatch[2].toLowerCase();
    pack_size = `${num} ${u}`;

    if (u === "gm" || u === "g") unit = "g";
    else if (u === "ml") unit = "ml";
    else if (u === "mg") unit = "mg";
    else if (u === "kg") unit = "kg";
    else if (u.startsWith("tab")) unit = "Tablets";
    else if (u.startsWith("cap")) unit = "Capsules";
    else unit = u.toUpperCase();
  }

  // Infer product type
  if (combined.includes("tablet") || combined.includes("tab")) {
    product_type = "Tablet";
  } else if (combined.includes("capsule") || combined.includes("cap")) {
    product_type = "Capsule";
  } else if (combined.includes("syrup") || combined.includes("liquid") || combined.includes("tonic")) {
    product_type = "Syrup";
  } else if (combined.includes("drops") || combined.includes("drop")) {
    product_type = "Drops";
  } else if (combined.includes("gel")) {
    product_type = "Gel";
  } else if (combined.includes("cream") || combined.includes("ointment")) {
    product_type = "Cream";
  } else if (combined.includes("scrub") || combined.includes("wash") || combined.includes("soap")) {
    product_type = "General";
  } else if (combined.includes("injection") || combined.includes("vial")) {
    product_type = "Injection";
  } else if (combined.includes("powder")) {
    product_type = "Powder";
  }

  return {
    pack_size: pack_size || "1",
    unit: unit || "Pieces",
    product_type,
  };
}
