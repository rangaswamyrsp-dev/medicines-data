import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LookupKind = "manufacturers" | "types" | "units";

const DEFAULT_SUGGESTIONS: Record<LookupKind, string[]> = {
  manufacturers: [
    "Cipla",
    "Sun Pharma",
    "Dr. Reddy",
    "Mankind",
    "Abbott",
    "Lupin",
    "Torrent",
    "Alkem",
    "Zydus",
    "Glenmark",
  ],
  types: [
    "Tablet",
    "Capsule",
    "Syrup",
    "Injection",
    "Cream",
    "Gel",
    "Drops",
    "Powder",
    "Suspension",
    "Ointment",
    "Eye Drops",
    "Inhaler",
    "Other",
  ],
  units: [
    "Tablets",
    "Capsules",
    "Strips",
    "Bottles",
    "Tubes",
    "Boxes",
    "Pieces",
    "Vials",
    "Sachets",
    "Packs",
    "1",
    "ml",
    "30ml",
    "50ml",
    "60ml",
    "80ml",
    "100ml",
    "200ml",
    "500ml",
    "g",
    "5g",
    "10g",
    "gm",
    "500gm",
    "mg",
    "kg",
  ],
};

function getLocalCustom(kind: LookupKind): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`custom_lookups_${kind}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCustom(kind: LookupKind, name: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalCustom(kind);
    if (!current.some((c) => c.toLowerCase() === name.toLowerCase())) {
      localStorage.setItem(`custom_lookups_${kind}`, JSON.stringify([...current, name]));
    }
  } catch {}
}

export function useLookups() {
  const qc = useQueryClient();
  const [localCustom, setLocalCustom] = useState<Record<LookupKind, string[]>>({
    manufacturers: getLocalCustom("manufacturers"),
    types: getLocalCustom("types"),
    units: getLocalCustom("units"),
  });

  // Query ONLY public.inventory table for existing distinct values
  const { data: dbValues = { manufacturers: [], types: [], units: [] } } = useQuery({
    queryKey: ["inventory-distinct-lookups"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("inventory")
          .select("manufacturer, type, units");
        if (error || !data) return { manufacturers: [], types: [], units: [] };

        const manufacturers = [
          ...new Set(data.map((r) => r.manufacturer?.trim()).filter(Boolean)),
        ];
        const types = [
          ...new Set(data.map((r) => r.type?.trim()).filter(Boolean)),
        ];
        const units = [
          ...new Set(data.map((r) => r.units?.trim()).filter(Boolean)),
        ];

        return { manufacturers, types, units };
      } catch {
        return { manufacturers: [], types: [], units: [] };
      }
    },
  });

  // Combine initial defaults, distinct values from inventory table, and any newly typed values
  const manufacturers = Array.from(
    new Set([
      ...DEFAULT_SUGGESTIONS.manufacturers,
      ...dbValues.manufacturers,
      ...localCustom.manufacturers,
    ])
  ).sort();

  const types = Array.from(
    new Set([
      ...DEFAULT_SUGGESTIONS.types,
      ...dbValues.types,
      ...localCustom.types,
    ])
  ).sort();

  const units = Array.from(
    new Set([
      ...DEFAULT_SUGGESTIONS.units,
      ...dbValues.units,
      ...localCustom.units,
    ])
  ).sort();

  // Allows user to enter any new value directly without creating separate database tables!
  const addLookup = async (kind: LookupKind, rawName: string): Promise<string> => {
    const name = rawName.trim();
    if (!name) throw new Error("Please enter a name");

    saveLocalCustom(kind, name);
    setLocalCustom((prev) => ({
      ...prev,
      [kind]: Array.from(new Set([...prev[kind], name])),
    }));

    return name;
  };

  return {
    manufacturers,
    types,
    units,
    addLookup,
    loading: false,
  };
}
