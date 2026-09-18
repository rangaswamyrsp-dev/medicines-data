import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appendRows,
  ensureHeaderRow,
  getSpreadsheetInfo,
  parseSpreadsheetId,
} from "./sheets.server";

export const inventoryInputSchema = z.object({
  item_name: z.string().trim().min(1, "Item Name is required"),
  manufacturer: z.string().trim().min(1, "Manufacturer is required"),
  type: z.string().trim().min(1, "Please select a type"),
  batch_code: z.string().trim().min(1, "Batch Code is required"),
  pack_size: z.string().trim().min(1, "Pack Size is required"),
  no_of_pack: z.coerce.number({ invalid_type_error: "Please enter a valid number of packs" }).positive("Please enter a valid number of packs"),
  units: z.string().trim().min(1, "Please select a unit"),
  mrp: z.coerce.number({ invalid_type_error: "Please enter a valid MRP" }).positive("Please enter a valid MRP"),
  expiry_month: z.coerce.number().int().min(1, "Please select expiry month").max(12),
  expiry_year: z.coerce.number().int().min(2000, "Please select expiry year").max(2100),
});
export type InventoryInput = z.infer<typeof inventoryInputSchema>;

type InventoryRow = {
  user_name: string;
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
  created_at: string;
};

function toSheetRow(r: InventoryRow) {
  const mm = String(r.expiry_month).padStart(2, "0");
  return [
    r.user_name,
    r.item_name,
    r.manufacturer,
    r.type,
    r.batch_code,
    r.pack_size,
    Number(r.no_of_pack),
    r.units,
    Number(r.mrp),
    mm,
    r.expiry_year,
    `${mm}/${r.expiry_year}`,
    new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  ];
}

/** Save a record, then append it to the configured Google Sheet. */
export const addInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inventoryInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
    const userName = profile?.name ?? "Unknown";

    const { data: row, error } = await supabase
      .from("inventory")
      .insert({ ...data, user_id: userId, user_name: userName })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { data: settings } = await supabase.from("app_settings").select("spreadsheet_id, sheet_name").eq("id", 1).maybeSingle();

    let sheetError: string | null = null;
    if (settings?.spreadsheet_id) {
      try {
        await appendRows(settings.spreadsheet_id, settings.sheet_name, [toSheetRow(row)]);
        await supabase.from("inventory").update({ sheet_synced: true, sheet_error: null }).eq("id", row.id);
      } catch (e) {
        sheetError = e instanceof Error ? e.message : "Unknown Google Sheets error";
        await supabase.from("inventory").update({ sheet_error: sheetError }).eq("id", row.id);
      }
    } else {
      sheetError = "No Google Sheet configured yet";
      await supabase.from("inventory").update({ sheet_error: sheetError }).eq("id", row.id);
    }

    return { id: row.id, sheetSynced: !sheetError, sheetError };
  });

/** Re-send every record that has not reached the sheet yet (own rows, or all rows for admins). */
export const retryUnsynced = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: settings } = await supabase.from("app_settings").select("spreadsheet_id, sheet_name").eq("id", 1).maybeSingle();
    if (!settings?.spreadsheet_id) throw new Error("No Google Sheet configured yet");

    const { data: rows, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("sheet_synced", false)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { sent: 0 };

    await appendRows(settings.spreadsheet_id, settings.sheet_name, rows.map(toSheetRow));
    await supabase
      .from("inventory")
      .update({ sheet_synced: true, sheet_error: null })
      .in("id", rows.map((r) => r.id));
    return { sent: rows.length };
  });

/** Admin: verify a sheet, write the header row if needed, and save the config. */
export const saveSheetSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sheetUrl: z.string().min(1, "Paste the Google Sheet link"), sheetName: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only an admin can change the Google Sheet settings");

    const spreadsheetId = parseSpreadsheetId(data.sheetUrl);
    if (!spreadsheetId) throw new Error("That does not look like a Google Sheets link");

    const info = await getSpreadsheetInfo(spreadsheetId);
    if (!info.sheets.includes(data.sheetName)) {
      throw new Error(`Tab "${data.sheetName}" was not found. Available tabs: ${info.sheets.join(", ")}`);
    }
    const header = await ensureHeaderRow(spreadsheetId, data.sheetName);

    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: 1, spreadsheet_id: spreadsheetId, sheet_name: data.sheetName, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);

    return { title: info.title, sheets: info.sheets, header, spreadsheetId };
  });

/** Admin: check the currently saved sheet is still reachable. */
export const checkSheetConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: settings } = await supabase.from("app_settings").select("spreadsheet_id, sheet_name").eq("id", 1).maybeSingle();
    if (!settings?.spreadsheet_id) return { configured: false as const };
    try {
      const info = await getSpreadsheetInfo(settings.spreadsheet_id);
      return { configured: true as const, ok: true as const, title: info.title, sheetName: settings.sheet_name, spreadsheetId: settings.spreadsheet_id };
    } catch (e) {
      return { configured: true as const, ok: false as const, error: e instanceof Error ? e.message : "Unknown error", sheetName: settings.sheet_name, spreadsheetId: settings.spreadsheet_id };
    }
  });
