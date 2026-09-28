// Supabase Edge Function for Barcode Product Lookup
// Follows Deno runtime standards for Supabase
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();
    if (!barcode) {
      return new Response(JSON.stringify({ error: "Barcode is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = Deno.env.get("PRODUCT_API_PROVIDER") || "upcitemdb";
    const apiKey = Deno.env.get("PRODUCT_API_KEY") || "";
    const apiUrl = Deno.env.get("PRODUCT_API_URL") || "";

    // Forward to UPCitemdb or OpenProductFacts
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (apiKey) {
      headers["user_key"] = apiKey;
      headers["key_type"] = "3scale";
    }

    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
      headers,
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ found: false, message: "Product not found." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const item = json.items?.[0];
    if (!item) {
      return new Response(JSON.stringify({ found: false, message: "Product not found." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        found: true,
        source: "external_api",
        provider: "UPCitemdb",
        product: {
          barcode,
          product_name: item.title,
          brand_name: item.brand,
          manufacturer: item.brand || item.manufacturer,
          description: item.description,
          product_image_url: item.images?.[0] || null,
          lowest_price: item.lowest_recorded_price,
          highest_price: item.highest_recorded_price,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
