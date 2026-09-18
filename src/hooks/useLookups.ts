import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LookupKind = "manufacturers" | "types" | "units";

const config = {
  manufacturers: { table: "manufacturers", column: "manufacturer_name" },
  types: { table: "item_types", column: "type_name" },
  units: { table: "units", column: "unit_name" },
} as const;

async function fetchLookup(kind: LookupKind): Promise<string[]> {
  const { table, column } = config[kind];
  const { data, error } = await supabase.from(table).select(column).order(column);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[column] ?? "").filter(Boolean);
}

export function useLookups() {
  const qc = useQueryClient();
  const manufacturers = useQuery({ queryKey: ["lookup", "manufacturers"], queryFn: () => fetchLookup("manufacturers") });
  const types = useQuery({ queryKey: ["lookup", "types"], queryFn: () => fetchLookup("types") });
  const units = useQuery({ queryKey: ["lookup", "units"], queryFn: () => fetchLookup("units") });

  const addLookup = async (kind: LookupKind, rawName: string): Promise<string> => {
    const name = rawName.trim();
    if (!name) throw new Error("Please enter a name");
    const { table, column } = config[kind];
    const existing = (qc.getQueryData<string[]>(["lookup", kind]) ?? []).find((v) => v.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from(table).insert({ [column]: name, created_by: auth.user?.id } as never);
    if (error && error.code !== "23505") throw new Error(error.message);
    await qc.invalidateQueries({ queryKey: ["lookup", kind] });
    return name;
  };

  return {
    manufacturers: manufacturers.data ?? [],
    types: types.data ?? [],
    units: units.data ?? [],
    addLookup,
    loading: manufacturers.isLoading || types.isLoading || units.isLoading,
  };
}
